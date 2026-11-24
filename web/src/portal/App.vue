<script setup lang="ts">
// NEC 团队 AI 中台门户：Hero + TabNav + 16 个 Tab（所有面板常驻挂载、v-show 切换）。
import { computed, onMounted, watch } from 'vue'
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
import { tabs, initTabs, switchTab, applyHashRoute, replayLoginReturn } from './composables/useTabs'
import { auth, bootAuth } from '@shared/auth'
import { loadTodos } from './composables/useBanners'

const mainWidthClass = computed(() =>
  tabs.active === 'home' || tabs.active === 'apps' || tabs.active === 'dashboard' ? 'max-w-7xl' : 'max-w-5xl'
)

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

  <GoalBanner />
  <TodoBar />

  <main class="portal-main mx-auto px-4 sm:px-6 py-6 sm:py-8" :class="mainWidthClass">
    <HomeTab v-show="tabs.active === 'home'" @goto="switchTab" />
    <MyTasksTab v-show="tabs.active === 'my-tasks'" />
    <DrawingReviewTab v-show="tabs.active === 'drawing-review'" />
    <ReimburseTab v-show="tabs.active === 'reimburse'" />
    <TaskScheduleTab v-show="tabs.active === 'task-schedule'" />
    <SeasonGoalsTab v-show="tabs.active === 'season-goals'" />
    <AppsTab v-show="tabs.active === 'apps'" />
    <SkillsTab v-show="tabs.active === 'skills'" />
    <DocsTab v-show="tabs.active === 'docs'" />
    <ReposTab v-show="tabs.active === 'repos'" />
    <HardwareReviewTab v-show="tabs.active === 'hardware-review'" />
    <ContractApprovalTab v-show="tabs.active === 'contract-approval'" />
    <DashboardTab v-show="tabs.active === 'dashboard'" />
    <PrdTab v-show="tabs.active === 'prd'" />
    <AgentTab v-show="tabs.active === 'agent'" />
    <AdminTab v-show="tabs.active === 'admin'" />
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
