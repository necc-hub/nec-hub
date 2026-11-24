<script setup lang="ts">
// NEC 团队 AI 中台门户：Hero + TabNav + 当前可访问 Tab（离开即卸载）。
import { computed, onMounted, watch, type Component } from 'vue'
import HeroHeader from './components/HeroHeader.vue'
import TabNav from './components/TabNav.vue'
import GoalBanner from './components/GoalBanner.vue'
import TodoBar from './components/TodoBar.vue'
import HomeTab from './components/tabs/HomeTab.vue'
import MyTasksTab from './components/tabs/MyTasksTab.vue'
import DrawingReviewTab from './components/tabs/DrawingReviewTab.vue'
import ReimburseTab from './components/tabs/ReimburseTab.vue'
import TaskScheduleTab from './components/tabs/TaskScheduleTab.vue'
import SeasonGoalsTab from './components/tabs/SeasonGoalsTab.vue'
import AppsTab from './components/tabs/AppsTab.vue'
import SkillsTab from './components/tabs/SkillsTab.vue'
import DocsTab from './components/tabs/DocsTab.vue'
import ReposTab from './components/tabs/ReposTab.vue'
import HardwareReviewTab from './components/tabs/HardwareReviewTab.vue'
import ContractApprovalTab from './components/tabs/ContractApprovalTab.vue'
import DashboardTab from './components/tabs/DashboardTab.vue'
import PrdTab from './components/tabs/PrdTab.vue'
import AgentTab from './components/tabs/AgentTab.vue'
import AdminTab from './components/tabs/AdminTab.vue'
import { tabs, initTabs, switchTab, applyHashRoute, replayLoginReturn, gateVisible, TAB_LABELS, type TabId } from './composables/useTabs'
import { auth, bootAuth, tryStartLogin } from '@shared/auth'
import { loadTodos } from './composables/useBanners'
import { pendingHash } from '@shared/pendingTab'

const mainWidthClass = computed(() =>
  tabs.active === 'home' || tabs.active === 'apps' || tabs.active === 'dashboard' ? 'max-w-7xl' : 'max-w-5xl'
)

const TAB_COMPONENTS: Record<TabId, Component> = {
  home: HomeTab,
  'my-tasks': MyTasksTab,
  'drawing-review': DrawingReviewTab,
  reimburse: ReimburseTab,
  'task-schedule': TaskScheduleTab,
  'season-goals': SeasonGoalsTab,
  apps: AppsTab,
  skills: SkillsTab,
  docs: DocsTab,
  repos: ReposTab,
  'hardware-review': HardwareReviewTab,
  'contract-approval': ContractApprovalTab,
  dashboard: DashboardTab,
  prd: PrdTab,
  agent: AgentTab,
  admin: AdminTab,
}
const activeTabComponent = computed(() => gateVisible(tabs.active) ? TAB_COMPONENTS[tabs.active] : HomeTab)
const authNoticeTab = computed(() => auth.me.authenticated ? null : pendingHash.tab as TabId | null)

onMounted(async () => {
  initTabs()
  await bootAuth()
  loadTodos()
  replayLoginReturn()
})
watch(() => auth.tick, () => {
  loadTodos()
  applyHashRoute()
})
</script>

<template>
  <HeroHeader />
  <TabNav />

  <template v-if="auth.phase === 'ready' && auth.me.authenticated">
    <GoalBanner />
    <TodoBar />
  </template>

  <div v-if="authNoticeTab && !auth.me.authenticated" class="portal-auth-notice max-w-5xl mx-auto mt-4 px-4 sm:px-6" role="status">
    <div class="portal-card px-5 py-4 flex flex-wrap items-center gap-3">
      <span class="text-sm text-nec-navy flex-1 min-w-44">「{{ TAB_LABELS[authNoticeTab] }}」登录后可见，登录成功后返回该页面。</span>
      <button type="button" class="portal-button portal-button--primary" @click="tryStartLogin">登录查看</button>
    </div>
  </div>

  <main class="portal-main mx-auto px-4 sm:px-6 py-6 sm:py-8" :class="mainWidthClass">
    <component :is="activeTabComponent" :key="tabs.active" @goto="switchTab" />
  </main>

  <footer class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-xs text-nec-gray leading-relaxed">
    常州工 NEC · NEC Hub · BUILT TO DAWN — KEEP BUILDING<br />
    <a href="/about/" class="inline-flex min-h-11 items-center hover:underline text-nec-navy font-bold">→ 关于 NEC 与公开边界</a>
    <span aria-hidden="true" class="mx-2">·</span>
    <a href="/brand/" class="inline-flex min-h-11 items-center hover:underline text-nec-navy font-bold">NEC 品牌主视觉（Logo / PPT 模板 / VI 规范）</a>
    <span aria-hidden="true" class="mx-2">·</span>
    <a href="/llms.txt" class="inline-flex min-h-11 items-center hover:underline text-nec-navy font-bold">AI 可读摘要</a>
  </footer>
</template>
