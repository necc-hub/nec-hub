export const PORTAL_INTERNAL_TABS = [
  'my-tasks', 'reimburse', 'drawing-review', 'hardware-review', 'contract-approval',
  'task-schedule', 'season-goals', 'dashboard',
] as const

export interface PortalAccess {
  ready: boolean
  authenticated: boolean
  isAdmin: boolean
}

export function canViewPortalTab(tab: string, access: PortalAccess): boolean {
  if (tab === 'admin') return access.ready && access.authenticated && access.isAdmin
  if (!PORTAL_INTERNAL_TABS.includes(tab as typeof PORTAL_INTERNAL_TABS[number])) return true
  return access.ready && access.authenticated
}

export function resolvePortalRoute(
  parsed: string | null,
  pending: string | null,
  canView: (tab: string) => boolean,
): string | null {
  // A restricted hash is normalized to home; restore its pending target only after access is granted.
  return parsed === 'home' && pending && canView(pending) ? pending : parsed || pending
}
