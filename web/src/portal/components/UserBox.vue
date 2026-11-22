<script setup lang="ts">
// 用户盒：登录态徽章 / 飞书登录按钮 / 账号密码登录（本地账号，实习生等无飞书身份成员用）
import { computed, ref } from 'vue'
import { auth, getLastLogin, loginWithPassword, logout, startLogin } from '@shared/auth'
import { switchTab } from '@portal/composables/useTabs'
import AuthToast from '@shared/ui/AuthToast.vue'

const ROLE_TIPS: Record<string, string> = { external: '外部协作者：可查看公开数据，审批/报销等功能需队长开通' }

const me = computed(() => auth.me)
const config = computed(() => auth.config)
const exchanging = computed(() => auth.phase === 'exchanging')
const last = computed(() => getLastLogin())
const roleTip = computed(() => (me.value.user?.role && ROLE_TIPS[me.value.user.role]) || '')

const showPwdForm = ref(false)
const pwdUser = ref('')
const pwdPass = ref('')
const pwdBusy = ref(false)
const pwdErr = ref('')
async function submitPwd() {
  if (pwdBusy.value) return
  pwdErr.value = ''
  if (!pwdUser.value.trim() || !pwdPass.value) { pwdErr.value = '请输入账号和密码'; return }
  pwdBusy.value = true
  try {
    await loginWithPassword(pwdUser.value, pwdPass.value)
    showPwdForm.value = false
    pwdPass.value = ''
  } catch (e: any) {
    pwdErr.value = e.message || '登录失败'
  } finally {
    pwdBusy.value = false
  }
}

async function onLogout() {
  await logout()
  switchTab('home')
}
</script>

<template>
  <div id="user-box" class="user-box text-xs flex flex-wrap items-center justify-end gap-2 min-w-0">
    <template v-if="me.authenticated && me.user">
      <img v-if="me.user.avatar_url" :src="me.user.avatar_url" class="w-7 h-7 rounded-full" alt="" />
      <span class="font-medium text-nec-navy min-w-0">{{ me.user.name }}</span>
      <span class="px-2 py-0.5 rounded-full text-[10px] text-white bg-nec-navy" :title="roleTip || undefined">{{ me.user.role || '队员' }}</span>
      <span v-if="me.user.group" class="text-nec-gray hidden sm:inline">{{ me.user.group }}</span>
      <button @click="onLogout" class="min-h-11 sm:min-h-0 text-nec-gray hover:text-nec-navy ml-1">登出</button>
    </template>
    <template v-else-if="exchanging">
      <span class="inline-block w-3.5 h-3.5 border-2 border-nec-line border-t-nec-cyan rounded-full animate-spin"></span>
      <span class="text-nec-gray">飞书登录中…</span>
    </template>
    <template v-else-if="config.loginEnabled">
      <template v-if="last && last.name">
        <img v-if="last.avatar_url" :src="last.avatar_url" class="w-7 h-7 rounded-full opacity-70" alt="" />
        <span class="hidden md:inline text-xs text-nec-gray" :title="last.at ? new Date(last.at).toLocaleString('zh-CN') : ''">上次登录：{{ last.name }}</span>
      </template>
      <button @click="startLogin" class="min-h-11 sm:min-h-9 px-3 py-1.5 rounded-full text-white bg-nec-navy">{{ last && last.name ? '以 ' + last.name + ' 继续登录' : '飞书登录' }}</button>
    </template>
    <button v-if="!showPwdForm" @click="showPwdForm = true" class="min-h-11 sm:min-h-0 text-nec-gray hover:text-nec-navy">账号登录</button>
    <form v-else class="flex flex-wrap items-center justify-end gap-2 min-w-0" @submit.prevent="submitPwd">
      <input v-model="pwdUser" placeholder="账号" autocomplete="username"
             class="w-24 min-h-11 px-2 py-1 border border-nec-line rounded-lg text-nec-ink" :disabled="pwdBusy" />
      <input v-model="pwdPass" type="password" placeholder="密码" autocomplete="current-password"
             class="w-24 min-h-11 px-2 py-1 border border-nec-line rounded-lg text-nec-ink" :disabled="pwdBusy" />
      <button type="submit" class="min-h-11 px-3 py-1 rounded-full text-white bg-nec-navy" :disabled="pwdBusy">{{ pwdBusy ? '登录中…' : '登录' }}</button>
      <button type="button" class="min-h-11 text-nec-gray hover:text-nec-navy" :disabled="pwdBusy" @click="showPwdForm = false; pwdErr = ''">取消</button>
    </form>
  </div>
  <div v-if="pwdErr" class="text-xs mt-1 text-[color:var(--nec-danger)]">{{ pwdErr }}</div>

  <AuthToast />
</template>
