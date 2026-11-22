<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { appCover, appMonogram } from "../../utils/appCatalog";

const props = withDefaults(defineProps<{ name: string; title: string; compact?: boolean }>(), { compact: false });
const failed = ref(false);
const cover = computed(() => appCover(props.name));
watch(cover, () => { failed.value = false; });
</script>

<template>
  <span class="app-visual" :class="{ 'app-visual--compact': compact }">
    <img v-if="cover && !failed" :src="cover" alt="" loading="lazy" @error="failed = true" />
    <span v-else class="app-visual__fallback" aria-hidden="true">
      <svg viewBox="0 0 120 120" focusable="false">
        <path d="M0 30H120M0 60H120M0 90H120M30 0V120M60 0V120M90 0V120" />
        <circle cx="60" cy="60" r="28" />
        <path d="M44 60H76M60 44V76" />
      </svg>
      <b>{{ appMonogram(title) }}</b>
    </span>
  </span>
</template>
