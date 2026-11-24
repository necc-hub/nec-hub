<script setup lang="ts">
// NEC Hero：完整品牌舞台 + 回访用户紧凑品牌条，保留健康检查与登录盒。
import { computed, ref, onMounted } from 'vue'
import { auth, heroCompact } from '@shared/auth'
import { ORIGIN } from '@shared/api'
import { switchTab } from '@portal/composables/useTabs'
import UserBox from './UserBox.vue'

const compact = computed(() => {
  if (auth.phase !== 'ready') return false;
  auth.tick;
  return heroCompact();
})
const healthData = ref<any>(null)
const healthOk = ref<boolean | null>(null)
const panelOpen = ref(false)
const panelLoading = ref(false)
const mcpLine = ref('')
const validateLine = ref('')

onMounted(() => {
  fetch('/api/health').then(r => r.json()).then(d => {
    healthData.value = d
    healthOk.value = true
  }).catch(() => {
    healthOk.value = false
  })
})

async function toggleHealthPanel() {
  if (panelOpen.value) { panelOpen.value = false; return }
  panelOpen.value = true
  panelLoading.value = true
  mcpLine.value = ''
  validateLine.value = ''
  const t0 = performance.now()
  try {
    const resp = await fetch(ORIGIN + '/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    })
    const ms = Math.round(performance.now() - t0)
    mcpLine.value = resp.ok
      ? `<span style="color:var(--nec-success)">● 正常</span> · ${ms}ms`
      : resp.status === 401
        ? `<span style="color:var(--nec-success)">● 正常</span>（需鉴权）· ${ms}ms`
        : `<span style="color:var(--nec-warning)">● HTTP ${resp.status}</span>`
  } catch {
    mcpLine.value = `<span style="color:var(--nec-danger)">● 不可达</span>`
  }
  let vLine = `<span style="color:var(--nec-gray)">登录后可见</span>`
  if (auth.me.authenticated) {
    try {
      const r = await fetch('/api/validate/report')
      if (r.ok) {
        const rep = await r.json()
        vLine = rep && !rep.empty
          ? `${rep.total ? `<span style="color:var(--nec-danger)">● ${rep.total} 条异常</span>` : `<span style="color:var(--nec-success)">● 无异常</span>`} · 上次校验 ${rep.generatedAt ? new Date(rep.generatedAt).toLocaleString('zh-CN') : '—'}`
          : `<span style="color:var(--nec-gray)">暂无校验报告</span>`
      }
    } catch { /* 保留默认提示 */ }
  }
  validateLine.value = vLine
  panelLoading.value = false
}

function goDashboard() {
  panelOpen.value = false
  switchTab('dashboard')
}
</script>

<template>
  <header class="hero portal-hero" :class="{ compact }">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-6 relative hero-inner">
      <div class="portal-topbar relative z-30">
        <a href="#/home" class="portal-brand" aria-label="NEC Hub 首页">
          <img src="/brand/nec-logo.svg" alt="NEC" class="h-9 sm:h-10 w-auto shrink-0" />
          <span class="leading-tight min-w-0">
            <span class="block font-black text-lg text-nec-navy whitespace-nowrap">常州工NEC <span class="text-sm font-extrabold text-nec-cyan">in CIT</span></span>
            <span class="block mono text-[11px] text-nec-gray tracking-wider">newenergycoder.club</span>
          </span>
        </a>
        <span id="hero-mini" class="mono text-xs font-bold tracking-[.18em] ml-1 text-nec-navy">BUILT <span class="text-nec-cyan">TO</span> DAWN</span>

        <div class="portal-topbar__actions">
          <div class="relative">
            <button
              id="health"
              type="button"
              @click="toggleHealthPanel"
              title="点击查看全站健康详情"
              class="health-button text-xs cursor-pointer"
              :aria-expanded="panelOpen"
              aria-controls="health-panel"
              :style="healthOk === null
                ? 'background:var(--nec-fog);color:var(--nec-gray)'
                : healthOk
                  ? 'background:var(--nec-success-bg);color:var(--nec-success)'
                  : 'background:var(--nec-danger-bg);color:var(--nec-danger)'"
            >
              {{ healthOk === null ? '连接中…' : healthOk ? '● 服务正常' : '● 连接失败' }}
            </button>
            <div v-if="panelOpen" id="health-panel" class="portal-health-panel absolute right-0 top-full mt-2 w-72 sm:w-80 p-4 z-30 text-left">
              <p v-if="panelLoading" class="text-xs text-nec-gray">检测中…</p>
              <template v-else>
                <p class="text-xs font-bold mb-2 text-nec-navy">全站健康</p>
                <ul class="text-xs text-nec-gray space-y-1.5">
                  <li class="flex justify-between gap-2"><span>API 服务</span>
                    <span v-if="healthData"><span style="color:var(--nec-success)">● 正常</span> · {{ healthData.service || 'nec-hub' }}</span>
                    <span v-else style="color:var(--nec-danger)">● 异常</span>
                  </li>
                  <li class="flex justify-between gap-2"><span>最近心跳</span><span>{{ healthData && healthData.time ? new Date(healthData.time).toLocaleString('zh-CN') : '—' }}</span></li>
                  <li class="flex justify-between gap-2"><span>NEC-MCP 端点</span><span v-html="mcpLine"></span></li>
                  <li class="flex justify-between gap-2"><span>数据健康</span><span v-html="validateLine"></span></li>
                </ul>
                <button @click="goDashboard" class="mt-3 min-h-11 text-xs hover:underline text-nec-navy font-bold">数据健康详情 →</button>
              </template>
            </div>
          </div>
          <UserBox />
        </div>
      </div>

      <div id="hero-full" class="portal-hero__stage">
        <div class="portal-hero__copy">
          <p class="portal-hero__eyebrow mono">常州工 NEC · 开源工程实践社区 · NEC HUB</p>
          <h1 class="hero-title">BUILT <span class="to">TO</span> DAWN</h1>
          <p class="portal-hero__cn">为黎明而造</p>
          <p class="portal-hero__lede">聚合真实项目、团队应用、Skill 与开源仓库，把任务、评审与交付沉淀为可复用工程资产。</p>
          <div class="portal-hero__actions">
            <button type="button" class="portal-button portal-button--primary" @click="switchTab('my-tasks')">进入我的任务 <span aria-hidden="true">→</span></button>
            <button type="button" class="portal-button portal-button--secondary" @click="switchTab('apps')">浏览应用目录</button>
            <a class="portal-hero__about" href="/about/">了解 NEC 与公开边界 →</a>
          </div>
          <a class="portal-hero__warehouse" href="https://mes.newenergycoder.club/home.html" target="_blank" rel="noopener noreferrer">NEC 仓库作业台 · 找物品 / 扫标签 / 办工单 <span aria-hidden="true">↗</span></a>
        </div>
        <div class="portal-hero__object" aria-hidden="true">
          <svg viewBox="0 0 560 440" focusable="false">
            <circle cx="382" cy="148" r="112" class="hero-orbit hero-orbit--outer" />
            <circle cx="382" cy="148" r="86" class="hero-orbit hero-orbit--inner" />
            <path d="M70 340H510M110 368H470" class="hero-horizon" />
            <path d="M92 302L220 236L350 302L220 368Z" class="hero-plinth" />
            <path d="M220 236V112L350 178V302L220 368Z" class="hero-module" />
            <path d="M244 180L302 151M244 214L326 177M244 248L326 211" class="hero-module-lines" />
          </svg>
          <img src="/brand/nec-logo.svg" alt="" />
          <span class="mono">NEW ENERGY / NEW MAKING</span>
        </div>
      </div>
    </div>
    <div class="horizon" style="bottom:5px"></div>
    <div class="base-line"></div>
  </header>
</template>
