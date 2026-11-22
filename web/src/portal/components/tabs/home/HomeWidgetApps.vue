<script setup lang="ts">
// 我的应用快捷区：共享应用封面 + 最近使用排序 + 更新标识（前 6 个）
// 未读数：暂不实现——数据源缺失（/api/apps 与后端均无 per-app 未读计数/订阅接口），
// 待后续接入飞书消息或应用侧上报接口后再补；模板底部保留注释位。
import { ref, onMounted } from 'vue'
import AppVisual from '../../apps/AppVisual.vue'

const props = defineProps<{ shared: { load(name: string): Promise<any> } }>()

const apps = ref<any[] | null>(null)
const failed = ref(false)
const lastUsed = ref<Record<string, number>>({})

// 命名规范：标题里的「中文名 // 英文名」拆成主标题 + 副标题两行
function titleParts(title: string): string[] {
  return String(title || '').split(/\s*\/\/\s*/)
}
/** 卡内第二行：优先 /api/apps 的 description 字段，缺省用标题里的英文名，再缺省用应用名 */
function subTitle(a: any): string {
  return a.description || titleParts(a.title)[1] || a.name
}

// ---- 最近使用（localStorage nec_home_app_last_used：name → 点击时间戳） ----
const LAST_USED_KEY = 'nec_home_app_last_used'
function readLastUsed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAST_USED_KEY)
    const p = raw ? JSON.parse(raw) : {}
    return p && typeof p === 'object' ? p : {}
  } catch { return {} }
}
function markUsed(a: any) {
  const map = { ...lastUsed.value, [a.name]: Date.now() }
  lastUsed.value = map
  try { localStorage.setItem(LAST_USED_KEY, JSON.stringify(map)) } catch { /* 隐私模式失败静默 */ }
}
function fmtAgo(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (mins < 1) return '刚刚'
  if (mins < 60) return mins + ' 分钟前'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + ' 小时前'
  return Math.floor(hrs / 24) + ' 天前'
}

/** 更新标识：/api/apps 返回 updatedAt（ISO 字符串）；字段缺失或不可解析时省略 */
function updatedLabel(a: any): string {
  const t = new Date(a.updatedAt).getTime()
  if (!isFinite(t)) return ''
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return '更新于今天'
  return `更新于 ${days} 天前`
}

onMounted(async () => {
  lastUsed.value = readLastUsed()
  try {
    const list = (await props.shared.load('apps')) || []
    // 最近使用降序；无记录保持接口原序（驱动比较值为 0 时 sort 稳定不动）
    apps.value = list
      .slice()
      .sort((x: any, y: any) => (lastUsed.value[y.name] ?? 0) - (lastUsed.value[x.name] ?? 0))
      .slice(0, 6)
  } catch { failed.value = true }
})
</script>

<template>
  <p v-if="failed" class="text-sm text-nec-gray">加载失败，请刷新重试。</p>
  <p v-else-if="apps === null" class="text-sm text-nec-gray">加载中…</p>
  <p v-else-if="!apps.length" class="text-sm text-nec-gray">还没有应用上架，去「应用广场」发布第一个。</p>
  <div v-else class="home-app-list">
    <a v-for="a in apps" :key="a.name" :href="a.url" target="_blank" rel="noopener noreferrer" @click="markUsed(a)" class="home-app-row" :title="a.title">
      <AppVisual :name="a.name" :title="titleParts(a.title)[0]" compact />
      <span class="home-app-row__body">
        <span class="home-app-row__title">{{ titleParts(a.title)[0] }}</span>
        <span class="home-app-row__description">{{ subTitle(a) }}</span>
        <span class="home-app-row__meta">
          <span v-if="lastUsed[a.name]" class="home-app-usage">最近使用 · {{ fmtAgo(lastUsed[a.name]) }}</span>
          <span v-else>未使用</span>
          <span v-if="updatedLabel(a)">{{ updatedLabel(a) }}</span>
        </span>
      </span>
      <span class="home-app-row__arrow" aria-hidden="true">↗</span>
    </a>
  </div>
</template>