import type { AppIntegration } from "./app-integration";

/** 目录条目的最小形状：listPortalApps 合并视图与 vite 构建期 manifest 共用 */
export interface CatalogLike {
  name: string;
  title?: string;
  url?: string;
  source?: "builtin" | "r2" | "external";
  integration?: AppIntegration | null;
}

/**
 * 门户自己的镜像：门户已在 `/`，把它当"应用"再列一次只是噪音。
 * 不在合并视图返回，KV 注册表原样保留，随时可恢复。
 */
export const PORTAL_SELF_MIRRORS = new Set(["nec-hub-portal"]);

/**
 * 与内置应用同名的 R2 托管副本中，**仍作为独立入口保留**的白名单。
 * 其余同名 R2 副本视为重复入口，不再上架，统一以仓内版为准。
 *
 * domains 保留：`domains.newenergycoder.club` 是成员手工登记的独立域名入口，
 * 标题与内置版不同（「域名分发系统（自助申请三级域名）」），二者指向同一套代码。
 */
export const R2_MIRROR_KEEP = new Set(["domains"]);

/**
 * 历史已废弃的 R2 应用 → 现行入口。卡片保留（旧书签/旧通知里仍有引用），
 * 但标题标「已废弃」、链接指向现行入口，避免新单据再提交到旧线。
 */
export const DEPRECATED_MIRRORS: Record<string, { target: string }> = {
  drawing: { target: "drawing-review" },
};

/**
 * 从目录中剔除重复/废弃入口。纯函数，Worker 与构建期共用，不读 KV、不发请求。
 *
 * 规则（按顺序）：
 * 1. 已废弃的内置应用（integration.deprecated）不上架；源文件与 /apps/ 路由保留，见下方说明。
 * 2. 门户自镜像不上架。
 * 3. 与内置应用同名的 R2 副本不上架（白名单除外），避免同一功能两个入口。
 * 4. DEPRECATED_MIRRORS 中 keep=true 的条目保留，但标题注明废弃、链接指向现行入口。
 *
 * 注意：这里只影响"目录里列什么"。/apps/<name>/ 静态路由、独立域名 <name>.<zone>、
 * R2 对象与 KV 注册表条目都不动，已有链接不会 404。
 */
export function filterCatalogEntries<T extends CatalogLike>(entries: T[], builtinNames: Set<string>): T[] {
  const out: T[] = [];
  for (const entry of entries) {
    if (entry.integration?.deprecated) continue;
    if (PORTAL_SELF_MIRRORS.has(entry.name)) continue;

    if (entry.source === "builtin") {
      out.push(entry);
      continue;
    }

    const mirror = DEPRECATED_MIRRORS[entry.name];
    if (mirror) {
      out.push({
        ...entry,
        title: `${entry.title ?? entry.name}（已废弃，请改用新入口）`,
        url: `/apps/${mirror.target}/`,
        shadows: false,
      });
      continue;
    }

    if (entry.source === "r2" && builtinNames.has(entry.name) && !R2_MIRROR_KEEP.has(entry.name)) continue;
    out.push(entry);
  }
  return out;
}

/** 构建期用：deprecated 的内置应用不进 manifest（无注册表可查，只按声明判断） */
export function isCatalogEligible(entry: CatalogLike): boolean {
  if (entry.integration?.deprecated) return false;
  if (PORTAL_SELF_MIRRORS.has(entry.name)) return false;
  return true;
}
