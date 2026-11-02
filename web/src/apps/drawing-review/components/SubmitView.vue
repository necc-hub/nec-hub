<script setup lang="ts">
// 提交图纸报告书表单（原 #view-submit）：字段、校验、提交报文与原单文件版一致
// 并入原门户 Tab 能力：/start 智能默认值、项目/机型联想建议（/suggestions）、登录态预填设计负责人
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { auth } from '@shared/auth'
import { apiDr } from '@shared/api'

const emit = defineEmits<{ (e: 'submitted'): void }>()

const form = reactive({
  projectId: '',
  machineName: '',
  drawingVersion: '',
  designerId: '',
  designNotes: '',
})
const result = ref<{ ok: boolean; text: string } | null>(null)

// ---- 图纸文件上传（复用 /api/approvals/upload，与硬件评审同一通道） ----
interface UploadEntry { name: string; size: number; token?: string; uploading: boolean }
const uploadedFiles = ref<UploadEntry[]>([])
const submitting = ref(false)
const uploading = ref(false)

async function onFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // 允许重复选择同一文件
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      result.value = { ok: false, text: `「${file.name}」超过 10MB 上限，请压缩后上传` }
      continue
    }
    const entry: UploadEntry = { name: file.name, size: file.size, uploading: true }
    uploadedFiles.value.push(entry)
    uploading.value = true
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/approvals/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const saved = data.files?.[0]
      entry.token = saved?.key || ''
      entry.name = saved?.name || file.name
      entry.size = saved?.size ?? file.size
    } catch (err) {
      uploadedFiles.value = uploadedFiles.value.filter(f => f !== entry)
      result.value = { ok: false, text: `「${file.name}」上传失败：${(err as Error).message}` }
    } finally {
      entry.uploading = false
      uploading.value = uploadedFiles.value.some(f => f.uploading)
    }
  }
}

function removeFile(i: number) {
  uploadedFiles.value.splice(i, 1)
}

// ---- 联想建议（项目编号 / 机型名称，≥2 字符触发，300ms 防抖） ----
let suggestionTimeout: ReturnType<typeof setTimeout> | undefined
const suggestions = reactive<{ project: any[]; machine: any[] }>({ project: [], machine: [] })
const suggestOpen = reactive({ project: false, machine: false })

function handleInput(type: 'project' | 'machine') {
  clearTimeout(suggestionTimeout)
  const query = (type === 'project' ? form.projectId : form.machineName).trim()
  if (query.length < 2) {
    suggestOpen[type] = false
    return
  }
  suggestionTimeout = setTimeout(() => fetchSuggestions(query, type), 300)
  scheduleVersionFetch()
}

function showSuggestionsOnFocus(type: 'project' | 'machine') {
  const query = (type === 'project' ? form.projectId : form.machineName).trim()
  if (query.length >= 2) fetchSuggestions(query, type)
}

async function fetchSuggestions(query: string, type: 'project' | 'machine') {
  try {
    const projectId = type === 'machine' ? form.projectId : undefined
    const url = `/suggestions?q=${encodeURIComponent(query)}&type=${type}${projectId ? '&projectId=' + encodeURIComponent(projectId) : ''}`
    const data = await apiDr(url)
    if (data.ok && data.suggestions) {
      suggestions[type] = data.suggestions
      suggestOpen[type] = data.suggestions.length > 0
    }
  } catch { /* 联想失败静默，不阻塞填写 */ }
}

function selectSuggestion(type: 'project' | 'machine', value: string) {
  if (type === 'project') {
    form.projectId = value
    suggestOpen.project = false
    // 项目选择后自动触发机型联想
    setTimeout(() => {
      if (form.machineName.length >= 2) fetchSuggestions(form.machineName, 'machine')
    }, 100)
  } else {
    form.machineName = value
    suggestOpen.machine = false
  }
  scheduleVersionFetch()
}

// 点击外部隐藏联想
function onDocClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('#project-suggestions') && !t.closest('input[name="projectId"]')) suggestOpen.project = false
  if (!t.closest('#machine-suggestions') && !t.closest('input[name="machineName"]')) suggestOpen.machine = false
}

// 智能默认值：沿用上一单的项目/机型/版本/说明（仅填空白字段）
async function loadDefaults() {
  try {
    const data = await apiDr('/start')
    const d = data.defaults || {}
    if (!form.projectId && d.projectId) form.projectId = d.projectId
    if (!form.machineName && d.machineName) form.machineName = d.machineName
    if (!form.drawingVersion && d.drawingVersion) form.drawingVersion = d.drawingVersion
    if (!form.designNotes && d.designNotes) form.designNotes = d.designNotes
  } catch { /* 默认值加载失败静默 */ }
}

// ---- 字段联动：项目+机型确定后自动算下一版本号（用户手改过则不覆盖） ----
const versionTouched = ref(false)
const versionAutoHint = ref('')
let versionTimeout: ReturnType<typeof setTimeout> | undefined

function scheduleVersionFetch() {
  clearTimeout(versionTimeout)
  versionTimeout = setTimeout(fetchNextVersion, 500)
}

async function fetchNextVersion() {
  if (!form.projectId.trim() || !form.machineName.trim()) return
  try {
    const data = await apiDr(`/start?projectId=${encodeURIComponent(form.projectId.trim())}&machineName=${encodeURIComponent(form.machineName.trim())}`)
    const v = data.defaults?.drawingVersion
    if (v && !versionTouched.value) {
      form.drawingVersion = v
      versionAutoHint.value = `已按该项目+机型的历史评审自动定为 ${v}`
    }
  } catch { /* 版本联动失败静默，可手填 */ }
}

// ---- 设计负责人：默认当前登录人自动带入；代他人提交时展开 open_id 输入 ----
const delegateMode = ref(false)

onMounted(() => {
  document.addEventListener('click', onDocClick)
  if (auth.me.user && !form.designerId) form.designerId = auth.me.user.open_id
  loadDefaults()
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

async function onSubmit() {
  if (submitting.value) return
  // 客户端防呆：无文件 / 上传中直接拦截并给出明确指引，不发无效请求
  if (uploading.value) {
    result.value = { ok: false, text: '图纸文件上传中，请稍候再提交' }
    return
  }
  const files = uploadedFiles.value.filter(f => f.token).map(f => ({ name: f.name, token: f.token as string, size: f.size }))
  if (files.length === 0) {
    result.value = { ok: false, text: '请先上传至少一个图纸文件（PDF / DXF / 图片，单个 ≤10MB）' }
    return
  }
  submitting.value = true
  result.value = null
  try {
    const data = await apiDr('/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId: form.projectId,
        machineName: form.machineName,
        drawingVersion: form.drawingVersion,
        designerId: form.designerId,
        drawingFiles: files,
        designNotes: form.designNotes,
      }),
    })
    result.value = { ok: true, text: `提交成功：${data.reviewId}` }
    Object.keys(form).forEach(k => { (form as Record<string, string>)[k] = '' })
    uploadedFiles.value = []
    versionTouched.value = false
    versionAutoHint.value = ''
    delegateMode.value = false
    if (auth.me.user) form.designerId = auth.me.user.open_id
    emit('submitted')
  } catch (err) {
    result.value = { ok: false, text: '失败：' + (err as Error).message }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section id="view-submit">
    <div class="nec-card p-5">
      <h2 class="text-lg font-bold text-nec-ink mb-1">提交图纸报告书</h2>
      <p class="mono text-xs text-nec-gray mb-4 tracking-wider">DRAWING REVIEW SUBMISSION</p>
      <form id="submit-form" class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="relative">
            <label class="block text-sm font-medium text-nec-navy mb-1">项目编号</label>
            <input type="text" name="projectId" v-model="form.projectId" required class="mono w-full rounded-lg border border-nec-line px-3 py-2 text-sm" placeholder="PRJ-2026-001"
                   @input="handleInput('project')"
                   @focus="showSuggestionsOnFocus('project')" />
 <div v-show="suggestOpen.project" id="project-suggestions" class="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-40 overflow-y-auto bg-nec-paper border border-nec-line">
 <div v-for="s in suggestions.project" :key="s.value" class="px-3 py-2 cursor-pointer border-b border-nec-line"
                   @click="selectSuggestion('project', s.value)">
                <div class="text-sm font-medium text-nec-ink">{{ s.label }}</div>
                <div v-if="s.count" class="text-xs text-nec-gray">使用 {{ s.count }} 次</div>
              </div>
            </div>
          </div>
          <div class="relative">
            <label class="block text-sm font-medium text-nec-navy mb-1">机型名称</label>
            <input type="text" name="machineName" v-model="form.machineName" required class="w-full rounded-lg border border-nec-line px-3 py-2 text-sm" placeholder="R1 底盘"
                   @input="handleInput('machine')"
                   @focus="showSuggestionsOnFocus('machine')" />
 <div v-show="suggestOpen.machine" id="machine-suggestions" class="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-40 overflow-y-auto bg-nec-paper border border-nec-line">
 <div v-for="s in suggestions.machine" :key="s.value" class="px-3 py-2 cursor-pointer border-b border-nec-line"
                   @click="selectSuggestion('machine', s.value)">
                <div class="text-sm font-medium text-nec-ink">{{ s.label }}</div>
                <div v-if="s.count" class="text-xs text-nec-gray">使用 {{ s.count }} 次</div>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-nec-navy mb-1">图纸版本</label>
            <input type="text" name="drawingVersion" v-model="form.drawingVersion" required class="mono w-full rounded-lg border border-nec-line px-3 py-2 text-sm" placeholder="V1.0"
                   @input="versionTouched = true; versionAutoHint = ''" />
            <p v-if="versionAutoHint" class="text-xs text-nec-cyan mt-1">{{ versionAutoHint }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-nec-navy mb-1">设计负责人</label>
            <template v-if="!delegateMode">
              <div class="w-full rounded-lg border border-nec-line bg-nec-paper px-3 py-2 text-sm text-nec-ink">
                {{ auth.me.user?.name || '当前登录人' }}
                <span class="text-xs text-nec-gray">（自动带入，无需填写 open_id）</span>
              </div>
              <p class="text-xs mt-1"><a href="javascript:void(0)" class="link" @click="delegateMode = true">为他人代提交 →</a></p>
            </template>
            <template v-else>
              <input type="text" name="designerId" v-model="form.designerId" required class="mono w-full rounded-lg border border-nec-line px-3 py-2 text-sm" placeholder="ou_xxx（代提交人的 open_id）" />
              <p v-if="auth.me.user && form.designerId === auth.me.user.open_id" class="text-xs text-nec-gray mt-1">当前登录：{{ auth.me.user.name }}</p>
              <p class="text-xs mt-1"><a href="javascript:void(0)" class="link" @click="delegateMode = false; if (auth.me.user) form.designerId = auth.me.user.open_id">← 改回我自己</a></p>
            </template>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-nec-navy mb-1">图纸文件 <span class="text-red-500">*</span></label>
          <input type="file" multiple @change="onFilesChange"
                 accept=".pdf,.dxf,.dwg,.step,.stp,.png,.jpg,.jpeg,.zip"
                 class="w-full rounded-lg border border-dashed border-nec-line px-3 py-3 text-sm text-nec-gray cursor-pointer" />
          <p class="text-xs text-nec-gray mt-1">支持 PDF / DXF / 图片等，单个文件 ≤10MB，可多选</p>
          <ul v-if="uploadedFiles.length" class="mt-2 space-y-1">
            <li v-for="(f, i) in uploadedFiles" :key="i" class="flex items-center justify-between text-sm rounded-lg bg-nec-paper border border-nec-line px-3 py-1.5">
              <span class="truncate">
                {{ f.name }}
                <span class="text-xs text-nec-gray">（{{ (f.size / 1024).toFixed(0) }}KB）</span>
                <span v-if="f.uploading" class="text-xs text-nec-gray">上传中…</span>
                <span v-else-if="f.token" class="text-xs text-green-600">✓ 已上传</span>
              </span>
              <button type="button" class="text-nec-gray hover:text-red-500 ml-2" :disabled="f.uploading" @click="removeFile(i)">✕</button>
            </li>
          </ul>
        </div>
        <div>
          <label class="block text-sm font-medium text-nec-navy mb-1">设计说明</label>
          <textarea name="designNotes" v-model="form.designNotes" rows="3" required class="w-full rounded-lg border border-nec-line px-3 py-2 text-sm" placeholder="关键设计参数、变更点"></textarea>
        </div>
        <div class="flex justify-end">
          <button type="submit" :disabled="submitting || uploading" class="btn-primary text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
            {{ uploading ? '文件上传中…' : submitting ? '提交中…' : '提交评审单' }}
          </button>
        </div>
      </form>
      <p v-if="result" id="submit-result" class="mt-3 text-sm" :class="result.ok ? 'text-green-600' : 'text-red-600'">{{ result.text }}</p>
    </div>
  </section>
</template>
