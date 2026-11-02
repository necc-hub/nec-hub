/**
 * 模块小路由（架构优化 #4）：字面量路由优先、泛型兜底的显式路由表。
 *
 * 替代各模块「正则 if 链」——/start 被 /{id} 泛型匹配吞掉的 bug 就是 if 链顺序的结构性风险。
 * 用法：按「字面量在前、泛型在后」声明 RouteDef 数组，routeFirst 顺序求值，
 * 返回 null 表示无匹配，交回模块入口继续 fallthrough（与旧 if 链语义一致）。
 */

export interface RouteDef {
  method: "GET" | "POST";
  /** 字面量全等路径（优先注册）或正则（含分组，handler 收到 match） */
  path: string | RegExp;
  handler: (match: RegExpMatchArray | null) => Promise<Response | null>;
}

export async function routeFirst(routes: RouteDef[], request: Request, pathname: string): Promise<Response | null> {
  for (const route of routes) {
    if (route.method !== request.method) continue;
    if (typeof route.path === "string") {
      if (pathname === route.path) return route.handler(null);
    } else {
      const match = pathname.match(route.path);
      if (match) return route.handler(match);
    }
  }
  return null;
}
