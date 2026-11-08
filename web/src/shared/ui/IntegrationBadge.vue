<script setup lang="ts">
import { computed } from 'vue'
import { integrationBadgeModel, type AppIntegration } from '@shared/app-integration'

const props = defineProps<{ integration?: AppIntegration | null }>()
const model = computed(() => integrationBadgeModel(props.integration))
const classes = {
  muted: 'bg-gray-100 text-gray-500 border-gray-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
    :class="classes[model.tone]"
  >
    <template v-if="model.levelLabel">{{ model.levelLabel }} · </template>{{ model.statusLabel }}
  </span>
</template>
