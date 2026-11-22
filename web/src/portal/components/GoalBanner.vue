<script setup lang="ts">
// FE-04：赛季目标关键节点提醒；默认摘要，展开后保留完整目标列表。
import { computed, ref } from 'vue'
import { goalBanner, dismissGoalBanner, goalRisk } from '@portal/composables/useBanners'
import { goalBannerSummary } from '../utils/goalSummary'

const expanded = ref(false)
const summary = computed(() => goalBannerSummary(goalBanner.items))

function labelOf(it: any): { cls: string; text: string } {
  if (it.overdue) return { cls: '#FCA5A5', text: `已逾期 ${Math.abs(it.daysLeft ?? 0)} 天` }
  if (goalRisk(it.deadline, it.progress) === 'late') return { cls: '#FCA5A5', text: `⚠ T-${it.daysLeft} 天` }
  return { cls: '', text: `T-${it.daysLeft} 天` }
}
</script>

<template>
  <div
    id="goal-banner"
    v-show="goalBanner.items.length"
    class="goal-alert"
    :class="summary?.tone === 'danger' ? 'goal-alert--danger' : 'goal-alert--warning'"
  >
    <div class="goal-alert__inner">
      <span class="goal-alert__mark" aria-hidden="true">!</span>
      <button
        type="button"
        class="goal-alert__summary"
        :aria-expanded="expanded"
        aria-controls="goal-banner-details"
        @click="expanded = !expanded"
      >
        <span class="goal-alert__count">{{ summary?.overdueCount ? `${summary.overdueCount} 项目标逾期` : `${summary?.count ?? 0} 个临近节点` }}</span>
        <span v-if="summary?.maxOverdueDays" class="goal-alert__days">最长 {{ summary.maxOverdueDays }} 天</span>
        <span class="goal-alert__lead">{{ summary?.title }}</span>
        <span class="goal-alert__toggle">{{ expanded ? '收起' : '查看详情' }} <span aria-hidden="true">{{ expanded ? '↑' : '↓' }}</span></span>
      </button>
      <button type="button" class="goal-alert__close" aria-label="关闭目标提醒" @click="dismissGoalBanner">×</button>
    </div>
    <div v-show="expanded" id="goal-banner-details" class="goal-alert__details">
      <a
        v-for="(it, i) in goalBanner.items"
        :key="i"
        :href="it.link"
        target="_blank"
        rel="noopener noreferrer"
        class="goal-alert__detail"
      >
        <b>{{ labelOf(it).text }}</b>
        <span>{{ it.title }}</span>
        <small>{{ it.group }} · {{ it.progress === null ? '未填写进度' : Math.round(it.progress) + '%' }}</small>
      </a>
    </div>
  </div>
</template>
