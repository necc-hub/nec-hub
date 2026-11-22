<script setup lang="ts">
import { computed } from "vue";
import IntegrationBadge from "@shared/ui/IntegrationBadge.vue";
import AppVisual from "./AppVisual.vue";
import { catalogNumber } from "../../utils/appCatalog";

const props = defineProps<{ a: any; index: number }>();
const external = computed(() => props.a.source !== "builtin");
</script>

<template>
  <a
    class="app-catalog-row"
    :href="a.url"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
  >
    <span class="app-catalog-row__number mono">{{ catalogNumber(index) }}</span>
    <AppVisual :name="a.name" :title="a.title" />
    <span class="app-catalog-row__body">
      <span class="app-catalog-row__title">
        <b>{{ a.title }}</b>
        <span aria-hidden="true">↗</span>
      </span>
      <span class="app-catalog-row__description">{{ a.description || a.desc || 'NEC 团队应用' }}</span>
      <span class="app-catalog-row__meta">
        <IntegrationBadge :integration="a.integration" />
        <small v-if="external">
          {{ a.author || 'NEC 队员' }}<template v-if="a.version"> · v{{ a.version }}</template>
          · 更新于 {{ a.updatedAt ? new Date(a.updatedAt).toLocaleDateString('zh-CN') : '—' }}
        </small>
      </span>
      <small v-if="a.shadows" class="app-catalog-row__warning">双版本：此行进入 R2 独立域名版，/apps/ 路径为仓内版</small>
    </span>
  </a>
</template>
