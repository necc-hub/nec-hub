// Tab 切换 + Hash 路由：/#/dashboard 等深链可直达对应面板，刷新/分享不丢位置（旧式 #tab-dashboard 自动升级）
import { reactive } from 'vue'
import { auth, canAccessAdmin } from '@shared/auth'
import { pendingHash } from '@shared/pendingTab'
import { canViewPortalTab, PORTAL_INTERNAL_TABS, resolvePortalRoute } from '../utils/portalVisibility'

export const TAB_IDS = ['home', 'my-tasks', 'drawing-review', 'reimburse', 'task-schedule', 'season-goals', 'apps', 'skills', 'docs', 'repos', 'hardware-review', 'contract-approval', 'dashboard', 'prd', 'agent', 'admin'] as const
export type TabId = (typeof TAB_IDS)[number]

// 低频 Tab（Skill 中心/资料页/开源仓库/硬件评审/合同审批）默认收进「更多」，保持导航高频入口精简
export const MORE_TABS: TabId[] = ['skills', 'docs', 'repos', 'hardware-review', 'contract-approval']

// 登录门控 Tab：未登录与登录状态初始化期间均不可见，组件也不挂载。
export const GATE_TABS: TabId[] = [...PORTAL_INTERNAL_TABS]

// 管理门控 Tab：登录且角色命中 队长/组长/指导/管理员 才可见（展示侧开关，真正鉴权以后端 /api/admin/overview 为准）
export const ADMIN_TABS: TabId[] = ['admin']

export const TAB_LABELS: Record<TabId, string> = {
  home: '我的首页',
  'my-tasks': '我的任务',
  'drawing-review': '图纸评审',
  reimburse: '报销',
  'task-schedule': '任务排期',
  'season-goals': '赛季目标',
  apps: '应用广场',
  skills: 'Skill 中心',
  docs: '资料页',
  repos: '开源仓库',
  'hardware-review': '硬件评审',
  'contract-approval': '合同审批',
  dashboard: '数据看板',
  prd: 'PRD 看板',
  agent: 'NEC-MCP',
  admin: '管理',
}

export const tabs = reactive({
  active: 'home' as TabId,
  more: false,
})

/** 登录门控：内部工作页仅在会话确认后可见；管理 Tab 另需管理角色。 */
export function gateVisible(tab: TabId): boolean {
  return canViewPortalTab(tab, {
    ready: auth.phase === 'ready',
    authenticated: !!(auth.me.authenticated && auth.me.user),
    isAdmin: canAccessAdmin(),
  })
}

export function isTabVisible(tab: TabId): boolean {
  if (!gateVisible(tab)) return false
  if (MORE_TABS.includes(tab)) return tabs.more
  return true
}

export function switchTab(tab: string, opts: { silent?: boolean; preservePending?: boolean } = {}): boolean {
  if (!(TAB_IDS as readonly string[]).includes(tab)) return false
  const t = tab as TabId
  // 门控关闭时绝不改变当前页面；调用方可在顶部显示登录提示。
  if (!gateVisible(t)) return false
  if (!isTabVisible(t) && MORE_TABS.includes(t)) tabs.more = true
  tabs.active = t
  if (!opts.preservePending) pendingHash.tab = null
  if (!opts.silent) {
    const canonical = '#/' + tab
    if (location.hash !== canonical) history.replaceState(null, '', location.pathname + location.search + canonical)
  }
  return true
}

export function parseHashTab(): string | null {
  let m = location.hash.match(/^#\/([a-z-]+)$/)
  if (m) return m[1]
  m = location.hash.match(/^#tab-([a-z-]+)$/) // 旧式断链兼容
  return m ? m[1] : null
}

export function applyHashRoute() {
  const parsed = parseHashTab()
  // 受限深链会规范化到首页；登录就绪后优先恢复已暂存且获准的目标。
  const tab = resolvePortalRoute(parsed, pendingHash.tab, tabId =>
    (TAB_IDS as readonly string[]).includes(tabId) && gateVisible(tabId as TabId)
  )
  if (!tab) return
  if (switchTab(tab, { silent: true })) {
    pendingHash.tab = null
    const canonical = '#/' + tab
    if (location.hash !== canonical) history.replaceState(null, '', location.pathname + location.search + canonical)
  } else if ((TAB_IDS as readonly string[]).includes(tab)) {
    // 暂存受限目标供登录后恢复，同时将当前页面与 URL 留在公开首页。
    pendingHash.tab = tab
    if (!gateVisible(tab as TabId)) switchTab('home', { preservePending: true })
  } else {
    // 未知 hash：落回首页
    pendingHash.tab = null
    switchTab('home', { silent: true })
    history.replaceState(null, '', location.pathname + location.search + '#/home')
  }
}

export function setMoreTabs(expanded: boolean) {
  tabs.more = expanded
}

export function toggleMoreTabs() {
  tabs.more = !tabs.more
}

export function initTabs() {
  window.addEventListener('hashchange', applyHashRoute)
  applyHashRoute()
}

/** OAuth 往返后恢复暂存的深链目标；同时重放所有登录门控 Tab 的 pendingHash（ST-02） */
export function replayLoginReturn() {
  const returnTab = sessionStorage.getItem('nec_login_return_tab')
  if (returnTab) {
    sessionStorage.removeItem('nec_login_return_tab')
    if (!parseHashTab()) pendingHash.tab = returnTab
  }
  applyHashRoute()
}
