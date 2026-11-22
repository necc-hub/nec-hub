<script setup lang="ts">
// 应用广场：manifest 驱动，三组应用共用编号目录行与集成徽章。
import { ref, computed, onMounted } from 'vue'
import { PUBLISH_PROMPT } from '@shared/prompts'
import { copyText } from '@shared/api'
import AppCatalogRow from '../apps/AppCatalogRow.vue'

const apps = ref<any[] | null>(null)
const showPrompt = ref(false)

onMounted(() => {
  fetch('/api/apps').then(r => r.json()).then(list => { apps.value = Array.isArray(list) ? list : [] }).catch(() => { apps.value = [] })
})

const coreApps = computed(() => (apps.value ?? []).filter(a => a.source === 'builtin' && a.group === 'core'))
const standaloneApps = computed(() => (apps.value ?? []).filter(a => a.source === 'builtin' && a.group !== 'core'))
const communityApps = computed(() => (apps.value ?? []).filter(a => a.source !== 'builtin'))
</script>

<template>
  <section id="tab-apps" class="apps-catalogue">
    <div class="apps-catalogue__header">
      <div class="min-w-0">
        <p class="apps-catalogue__eyebrow mono">NEC PRODUCT CATALOGUE / 2026</p>
        <h2>应用广场</h2>
        <p class="apps-catalogue__lede">把评审、协作与创造，装进一套清晰可用的工具目录。</p>
      </div>
      <button @click="showPrompt = !showPrompt" class="portal-button portal-button--primary" :aria-expanded="showPrompt" aria-controls="publish-box">＋ 发布我的应用</button>
    </div>

    <div v-if="showPrompt" id="publish-box" class="portal-card mb-8 p-5 sm:p-6">
      <h3 class="font-bold mb-2 text-nec-navy">上架 Prompt（复制后发给你的 Agent）</h3>
      <pre class="prompt text-sm bg-gray-900 text-green-300 rounded-lg p-4" id="publish-prompt">{{ PUBLISH_PROMPT }}</pre>
      <button @click="copyText(PUBLISH_PROMPT)" class="mt-3 min-h-11 text-sm text-white px-4 py-1.5 rounded-full bg-nec-navy">复制 Prompt</button>
    </div>

    <div v-if="apps === null" class="portal-card p-8 text-center text-sm text-nec-gray">应用目录加载中…</div>

    <section v-if="coreApps.length" class="app-catalog-group">
      <header class="app-catalog-group__header">
        <div><span class="mono">01 / CORE WORKFLOWS</span><h3>核心流程</h3></div>
        <small>{{ coreApps.length }} 个应用</small>
      </header>
      <div class="app-catalog-list">
        <AppCatalogRow v-for="(a, index) in coreApps" :key="a.name" :a="a" :index="index" />
      </div>
    </section>

    <section v-if="standaloneApps.length" class="app-catalog-group">
      <header class="app-catalog-group__header">
        <div><span class="mono">02 / INDEPENDENT TOOLS</span><h3>独立应用</h3></div>
        <small>{{ standaloneApps.length }} 个应用</small>
      </header>
      <div class="app-catalog-list">
        <AppCatalogRow v-for="(a, index) in standaloneApps" :key="a.name" :a="a" :index="index" />
      </div>
    </section>

    <section v-if="apps" class="app-catalog-group">
      <header class="app-catalog-group__header">
        <div><span class="mono">03 / COMMUNITY BUILDS</span><h3>队员上架应用</h3></div>
        <small>{{ communityApps.length }} 个应用</small>
      </header>
      <div id="apps-list" class="app-catalog-list">
        <div v-if="!communityApps.length" class="app-catalog-empty">
          <span class="mono" aria-hidden="true">00</span>
          <p>还没有队员应用上架。</p>
          <small>点击「发布我的应用」，把 Prompt 发给你的 Agent，上架第一个作品。</small>
        </div>
        <AppCatalogRow v-for="(a, index) in communityApps" :key="a.name" :a="a" :index="index" />
      </div>
    </section>
  </section>
</template>
