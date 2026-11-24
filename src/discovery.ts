import { DISCOVERY_LASTMOD, HUB_ORIGIN, PUBLIC_SITEMAP_PATHS, isPublicHtmlPath } from "./shared/discovery";

function text(body: string, contentType = "text/plain; charset=utf-8"): Response {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

export function robotsTxt(hostname: string): Response {
  if (hostname !== new URL(HUB_ORIGIN).hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
    // 预览、泛域名和未确认的部署域名不重复收录；正式 Hub 只保留一个规范入口。
    return text("User-agent: *\nDisallow: /\n");
  }
  return text(`# NEC Hub public discovery: https://hub.newenergycoder.club/llms.txt
# Public HTML is indexable; private work remains protected by authentication and noindex.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /mcp
Disallow: /apps/admin/

# Explicit AI crawler access to the same public-only rules.
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /mcp
Disallow: /apps/admin/

Sitemap: ${HUB_ORIGIN}/sitemap.xml
`);
}

export function sitemapXml(): Response {
  const urls = PUBLIC_SITEMAP_PATHS.map((path) => `  <url>
    <loc>${HUB_ORIGIN}${path}</loc>
    <lastmod>${DISCOVERY_LASTMOD}</lastmod>
    <changefreq>${path === "/" ? "weekly" : "monthly"}</changefreq>
  </url>`).join("\n");
  return text(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`, "application/xml; charset=utf-8");
}

export function handleDiscovery(request: Request): Response | null {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (url.pathname === "/robots.txt") return robotsTxt(url.hostname);
  if (url.pathname === "/sitemap.xml") return sitemapXml();
  return null;
}

/**
 * 内部工作区默认不索引；只有共享清单中的公开 HTML 才允许进入索引。
 * 非规范域名（含泛域名应用）保留自己的 robots 策略，不被 Hub 的规则覆盖。
 */
export function withDiscoveryHeaders(response: Response, request: Request): Response {
  const url = new URL(request.url);
  if (url.hostname !== new URL(HUB_ORIGIN).hostname && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return response;
  const contentType = response.headers.get("content-type") ?? "";
  const privateRoute = /^\/(api|auth)(\/|$)/.test(url.pathname) || url.pathname === "/mcp";
  const privateHtml = contentType.includes("text/html") && !isPublicHtmlPath(url.pathname);
  if (!privateRoute && !privateHtml) return response;
  if (response.headers.has("x-robots-tag")) return response;
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
