/** NEC Hub 的公开发现入口。只列已核实的公开页面，不把内部工作区变成搜索落地页。 */
export const HUB_ORIGIN = "https://hub.newenergycoder.club";
export const DISCOVERY_LASTMOD = "2026-11-25";

export const PUBLIC_APP_SEO: Record<string, { title: string; description: string }> = {
  k1: {
    title: "K1 Dashboard：3D 打印只读设备面板",
    description: "NEC K1 Dashboard 公开预览：查看创想 K1 系列的设备状态、温度趋势、打印历史与床网数据；公网静态页不连接或控制打印机。",
  },
  "mech-review-6014": {
    title: "6014 电机机械评审纪要",
    description: "NEC 6014 电机机械评审公开资料：评审纪要、转接板草图及 DXF、CSV 工程文件。",
  },
  scoring: {
    title: "NEC 评分看板",
    description: "NEC 公开只读评分看板，查看赛事成绩、评分记录与排名；数据为静态资料。",
  },
  "ress-solution": {
    title: "StarCharge RESS 场景方案",
    description: "StarCharge RESS 场景方案公开预览：场景视频、产品包 BOM 与本地配置导出，不连接实时产品服务。",
  },
};

export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/about/",
  "/brand/",
  ...Object.keys(PUBLIC_APP_SEO).map((name) => `/apps/${name}/`),
];

function normalizePath(pathname: string): string {
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

export function isPublicHtmlPath(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  return PUBLIC_SITEMAP_PATHS.some((path) => normalizePath(path) === normalized);
}
