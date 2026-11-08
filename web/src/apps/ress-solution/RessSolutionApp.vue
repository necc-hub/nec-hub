<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { scenarios } from './data'
import EnergyScene25D from './EnergyScene25D.vue'
import { normalizeVideoUrl } from './video-source'
import './ress-solution.css'

const PREVIEW_URL = '/assets/starcharge-ress/ress-scene-preview.mp4'
const POSTER_URL = '/assets/starcharge-ress/ress-scene-poster.png'
const activeId = ref('self')
const viewMode = ref<'iso' | 'video'>('iso')
const videoEl = ref<HTMLVideoElement | null>(null)
const videoUrl = ref(PREVIEW_URL)
const sourceType = ref<'preview' | 'libtv'>('preview')
const isPlaying = ref(false)
const isMuted = ref(true)
const currentTime = ref(0)
const duration = ref(16)
const showVideoModal = ref(false)
const urlInput = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
let objectUrl = ''

const current = computed(() => scenarios.find(item => item.id === activeId.value) ?? scenarios[0])
const currentIndex = computed(() => scenarios.findIndex(item => item.id === activeId.value))
const sourceBadge = computed(() => sourceType.value === 'preview' ? '本地动态预览 · 非 LibTV 成片' : 'LibTV 成片 · 已接入')
const segmentTime = computed(() => sourceType.value === 'preview' ? Math.max(0, currentTime.value - current.value.videoStart) : currentTime.value)
const progress = computed(() => {
  const total = sourceType.value === 'preview' ? 4 : duration.value
  return total > 0 ? Math.min(100, segmentTime.value / total * 100) : 0
})
const coreCount = computed(() => current.value.bom.filter(item => item.group === '核心设备').length)

function notify(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

async function playVideo() {
  if (!videoEl.value) return
  try {
    await videoEl.value.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
  }
}

async function seekScenario() {
  await nextTick()
  if (!videoEl.value) return
  videoEl.value.currentTime = sourceType.value === 'preview' ? current.value.videoStart : 0
  currentTime.value = videoEl.value.currentTime
  await playVideo()
}

function selectScenario(id: string) {
  activeId.value = id
  void seekScenario()
}

function onLoadedMetadata() {
  if (!videoEl.value) return
  duration.value = Number.isFinite(videoEl.value.duration) ? videoEl.value.duration : 16
  videoEl.value.muted = isMuted.value
  videoEl.value.currentTime = sourceType.value === 'preview' ? current.value.videoStart : 0
  void playVideo()
}

function onTimeUpdate() {
  if (!videoEl.value) return
  currentTime.value = videoEl.value.currentTime
  if (sourceType.value === 'preview' && currentTime.value >= current.value.videoStart + 4) {
    videoEl.value.currentTime = current.value.videoStart
    currentTime.value = current.value.videoStart
  }
}

async function togglePlay() {
  if (!videoEl.value) return
  if (videoEl.value.paused) await playVideo()
  else {
    videoEl.value.pause()
    isPlaying.value = false
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (videoEl.value) videoEl.value.muted = isMuted.value
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  return `00:${String(seconds).padStart(2, '0')}`
}

function downloadBom() {
  const rows = [
    ['场景', current.value.nav],
    ['产品包', current.value.packageName],
    ['说明', current.value.description],
    [],
    ['分类', '设备/配置', '型号', '数量', '关键规格'],
    ...current.value.bom.map(item => [item.group, item.name, item.model, item.quantity, item.spec]),
    [],
    ['依据', 'General Introduction of Starcharge RESS(1).pdf · 2024-09-20'],
    ['边界', '不含价格；光伏阵列、配电与实施配置需按项目深化；示例不构成未注明工况的性能承诺'],
  ]
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `StarCharge-RESS-${current.value.id}-BOM.csv`
  link.click()
  URL.revokeObjectURL(url)
  notify('当前产品包 BOM 已导出')
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(current.value.prompt)
    notify('LibTV 场景提示词已复制')
  } catch {
    notify('复制失败，请手动选择提示词')
  }
}

function setCustomVideo(url: string) {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = url.startsWith('blob:') ? url : ''
  sourceType.value = 'libtv'
  videoUrl.value = url
  showVideoModal.value = false
  void nextTick(() => {
    videoEl.value?.load()
  })
}

function applyUrl() {
  const value = urlInput.value.trim()
  if (!value) {
    notify('请输入 MP4 或 WebM 视频直链')
    return
  }
  try {
    setCustomVideo(normalizeVideoUrl(value))
    notify('LibTV 成片地址已接入')
  } catch {
    notify('视频地址无效，请输入 HTTP(S) 直链')
  }
}

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('video/')) {
    notify('请选择 MP4 或 WebM 视频文件')
    return
  }
  setCustomVideo(URL.createObjectURL(file))
  notify('本地 LibTV 成片已接入')
  input.value = ''
}

function restorePreview() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
  sourceType.value = 'preview'
  videoUrl.value = PREVIEW_URL
  showVideoModal.value = false
  void nextTick(() => videoEl.value?.load())
}

function onVideoError() {
  notify('视频加载失败，请检查直链或改用本地文件')
}

onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="ress-page">
    <header class="shell topbar">
      <div class="wordmark">
        <strong>STARCHARGE</strong>
        <span>RESS · SCENARIO SOLUTION</span>
      </div>
      <div class="top-actions">
        <button class="btn" type="button" @click="restorePreview">恢复预览</button>
        <button class="btn" type="button" @click="showVideoModal = true">接入 LibTV 成片</button>
        <button class="btn btn-gold" type="button" @click="downloadBom">导出当前 BOM</button>
      </div>
    </header>

    <main class="shell">
      <section class="hero reveal">
        <div>
          <div class="kicker">RESIDENTIAL ENERGY STORAGE SOLUTION · 2024 PRODUCT BASIS</div>
          <h1>一度电的场景，<br>一套系统的答案。</h1>
          <p>从真实家庭场景出发，将 Vesta、vBox、MID、AC Charger 与 Home App 组合为可讲解、可配置、可交付的高级产品解决方案。</p>
        </div>
        <div class="hero-index" aria-hidden="true">04</div>
      </section>

      <nav class="scenario-nav" aria-label="选择解决方案场景">
        <button
          v-for="(item, index) in scenarios"
          :key="item.id"
          class="scenario-tab"
          :class="{ active: item.id === activeId }"
          type="button"
          :aria-pressed="item.id === activeId"
          @click="selectScenario(item.id)"
        >
          <small>SCENE 0{{ index + 1 }}</small>
          <strong>{{ item.nav }}</strong>
        </button>
      </nav>

      <section class="solution-grid" :key="current.id">
        <div class="scene-panel reveal">
          <div class="scene-modebar" aria-label="场景展示模式">
            <button type="button" :class="{ active: viewMode === 'iso' }" :aria-pressed="viewMode === 'iso'" @click="viewMode = 'iso'; videoEl?.pause()">2.5D 交互场景</button>
            <button type="button" :class="{ active: viewMode === 'video' }" :aria-pressed="viewMode === 'video'" @click="viewMode = 'video'; seekScenario()">视频成片</button>
          </div>
          <EnergyScene25D v-if="viewMode === 'iso'" :scenario="current" />
          <div v-show="viewMode === 'video'" class="video-wrap">
            <video
              ref="videoEl"
              :src="videoUrl"
              :poster="POSTER_URL"
              autoplay
              muted
              playsinline
              preload="auto"
              :aria-label="`${current.nav}场景视频`"
              @loadedmetadata="onLoadedMetadata"
              @timeupdate="onTimeUpdate"
              @play="isPlaying = true"
              @pause="isPlaying = false"
              @error="onVideoError"
            ></video>
            <div class="video-shade"></div>
            <div class="source-badge">{{ sourceBadge }}</div>
          </div>

          <div class="scene-caption">
            <div>
              <div class="kicker">{{ current.eyebrow }}</div>
              <h2>{{ current.title }}</h2>
              <p>{{ current.subtitle }}</p>
            </div>
            <div class="scene-number" aria-hidden="true">0{{ currentIndex + 1 }}</div>
          </div>

          <div v-if="viewMode === 'video'" class="video-controls">
            <button class="control-btn" type="button" :aria-label="isPlaying ? '暂停视频' : '播放视频'" @click="togglePlay">{{ isPlaying ? 'Ⅱ' : '▶' }}</button>
            <button class="control-btn" type="button" :aria-label="isMuted ? '取消静音' : '静音'" @click="toggleMute">{{ isMuted ? '静' : '声' }}</button>
            <div class="progress-track" aria-hidden="true"><div class="progress-fill" :style="{ width: `${progress}%` }"></div></div>
            <span class="timecode">{{ formatTime(segmentTime) }} / {{ sourceType === 'preview' ? '00:04' : formatTime(duration) }}</span>
          </div>
          <p class="preview-note">{{ viewMode === 'iso' ? '2.5D 场景支持拖拽环绕、滚轮缩放、键盘方向键、视角预设与设备热点；产品点击结果与当前场景 BOM 同步呈现。' : '视频区域支持 LibTV 导出的 MP4/WebM 直链或本地文件。当前本地预览仅用于页面验收，不声称由 LibTV 生成；切换场景时预览自动定位到对应章节。' }}</p>
        </div>

        <aside class="bom-panel reveal" aria-label="当前场景产品包 BOM">
          <div class="bom-topline">
            <span>PRODUCT PACKAGE · BOM</span>
            <span class="bom-status">方案已组合</span>
          </div>
          <h2>{{ current.packageName }}</h2>
          <div class="package-en">{{ current.packageEn }}</div>
          <p class="bom-description">{{ current.description }}</p>

          <div class="metric-row">
            <div v-for="metric in current.metrics" :key="metric.label" class="metric">
              <strong>{{ metric.value }}</strong>
              <span>{{ metric.label }}</span>
            </div>
          </div>

          <div class="bom-heading">
            <h3>产品包配置清单</h3>
            <span>{{ coreCount }} 项核心设备 · 不含价格</span>
          </div>
          <table class="bom-table">
            <thead>
              <tr><th>设备 / 型号</th><th>数量</th><th>关键规格与交付边界</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in current.bom" :key="`${item.group}-${item.model}`">
                <td>
                  <span class="item-group">{{ item.group }}</span>
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-model">{{ item.model }}</span>
                </td>
                <td class="item-qty">{{ item.quantity }}</td>
                <td class="item-spec">{{ item.spec }}</td>
              </tr>
            </tbody>
          </table>

          <div class="bom-actions">
            <span class="bom-note">光伏、配电与实施项需项目深化；所有规格以对应型号最终选型为准。</span>
            <button class="btn btn-dark" type="button" @click="downloadBom">下载 CSV 清单</button>
          </div>
        </aside>
      </section>

      <section class="value-grid" :key="`${current.id}-values`" aria-label="场景方案价值">
        <article v-for="(value, index) in current.values" :key="value.title" class="value-card reveal">
          <small>0{{ index + 1 }} / VALUE</small>
          <h3>{{ value.title }}</h3>
          <p>{{ value.text }}</p>
        </article>
      </section>

      <footer class="footer">
        <span>产品依据：General Introduction of Starcharge RESS(1).pdf · 2024-09-20<br>本页为场景化配置建议，不构成报价、合同或未经注明工况的性能承诺。</span>
        <span>RESS / Vesta + vBox + MID + AC Charger<br><a href="/">返回 NEC HUB 门户</a></span>
      </footer>
    </main>

    <div v-if="showVideoModal" class="modal-backdrop" @click.self="showVideoModal = false">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="video-modal-title">
        <div class="modal-head">
          <div>
            <div class="kicker">LIBTV VIDEO SOURCE</div>
            <h2 id="video-modal-title">接入 LibTV 场景成片</h2>
          </div>
          <button class="close-btn" type="button" aria-label="关闭" @click="showVideoModal = false">×</button>
        </div>
        <p class="modal-copy">当前未检测到 LibTV 登录创作会话。可先在 LibTV 完成生成并导出，再将 MP4/WebM 直链粘贴到此处，或直接选择本地成片。LibTV 项目页地址不能作为视频源。</p>

        <label class="field-label" for="video-url">MP4 / WebM 视频直链</label>
        <input id="video-url" v-model="urlInput" class="text-input" type="url" placeholder="https://…/ress-scene.mp4" @keyup.enter="applyUrl" />
        <div class="modal-row">
          <button class="btn btn-gold" type="button" @click="applyUrl">接入视频</button>
          <label class="btn" for="video-file">选择本地成片</label>
          <input id="video-file" hidden type="file" accept="video/mp4,video/webm,video/*" @change="handleFile" />
          <a class="btn" href="https://www.liblib.tv/" target="_blank" rel="noreferrer">打开 LibTV</a>
        </div>

        <hr class="modal-divider" />
        <div class="kicker">当前场景 · {{ current.nav }}</div>
        <label class="field-label" for="libtv-prompt">LibTV 场景描述提示词</label>
        <textarea id="libtv-prompt" class="prompt-box" readonly :value="current.prompt"></textarea>
        <div class="modal-row">
          <button class="btn" type="button" @click="copyPrompt">复制提示词</button>
          <button class="btn" type="button" @click="restorePreview">使用本地动态预览</button>
        </div>
      </section>
    </div>

    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>
