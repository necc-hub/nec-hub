<script setup lang="ts">
// 常用资料（前 6 条）
import { ref, onMounted } from 'vue'

const props = defineProps<{ shared: { load(name: string): Promise<any> } }>()

const docs = ref<any[] | null>(null)
const failed = ref(false)

onMounted(async () => {
  try {
    docs.value = ((await props.shared.load('docs')) || []).slice(0, 6)
  } catch { failed.value = true }
})
</script>

<template>
  <p v-if="failed" class="text-sm text-nec-gray">加载失败，请刷新重试。</p>
  <p v-else-if="docs === null" class="text-sm text-nec-gray">加载中…</p>
  <p v-else-if="!docs.length" class="text-sm text-nec-gray">资料页暂无条目。</p>
  <ul v-else class="divide-y divide-nec-line">
    <li v-for="(d, i) in docs" :key="i" class="py-2.5">
      <a v-if="d.url" :href="d.url" target="_blank" rel="noopener noreferrer" class="hover:underline font-medium text-nec-navy">{{ d.title }}</a>
      <template v-else>
        <span class="font-medium text-nec-gray">{{ d.title }}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-nec-fog text-nec-gray">即将上线</span>
      </template>
      <p class="text-xs text-nec-gray mt-1 leading-relaxed">{{ d.description || '' }}</p>
    </li>
  </ul>
</template>
