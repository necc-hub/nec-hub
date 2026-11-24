import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { handleDiscovery, robotsTxt, sitemapXml, withDiscoveryHeaders } from "../discovery";
import { PUBLIC_APP_SEO, PUBLIC_SITEMAP_PATHS } from "../shared/discovery";

function jsonLdBlocks(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]) as Record<string, unknown>);
}

describe("公开发现与隐私边界", () => {
  it("正式域名 robots 允许公开内容，并屏蔽内部路由和公开 AI 爬虫", async () => {
    const response = handleDiscovery(new Request("https://hub.newenergycoder.club/robots.txt"))!;
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("User-agent: GPTBot");
    expect(body).toContain("User-agent: ClaudeBot");
    expect(body).toContain("User-agent: PerplexityBot");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /apps/admin/");
    expect(body).toContain("Sitemap: https://hub.newenergycoder.club/sitemap.xml");
  });

  it("预览和泛域名 robots 不重复收录", async () => {
    const response = robotsTxt("ress-solution.newenergycoder.club");
    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("sitemap 只包含公开 HTML 和规范 URL", async () => {
    const body = await sitemapXml().text();
    for (const path of PUBLIC_SITEMAP_PATHS) expect(body).toContain(`<loc>https://hub.newenergycoder.club${path}</loc>`);
    expect(body).not.toContain("/api/");
    expect(body).not.toContain("admin");
    expect(body).not.toContain("reimburse");
    expect(body).not.toContain("localhost");
    expect(PUBLIC_APP_SEO.k1.title).toBeTruthy();
  });

  it("内部 HTML、API 与 MCP 响应带 noindex，公开 HTML 不额外屏蔽", () => {
    const privateHtml = withDiscoveryHeaders(new Response("internal", { headers: { "content-type": "text/html" } }), new Request("https://hub.newenergycoder.club/apps/reimburse/"));
    expect(privateHtml.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    const api = withDiscoveryHeaders(new Response("{}"), new Request("https://hub.newenergycoder.club/api/whoami"));
    expect(api.headers.get("x-robots-tag")).toContain("noindex");
    const mcp = withDiscoveryHeaders(new Response("{}"), new Request("https://hub.newenergycoder.club/mcp"));
    expect(mcp.headers.get("x-robots-tag")).toContain("noindex");
    const publicPage = withDiscoveryHeaders(new Response("public", { headers: { "content-type": "text/html" } }), new Request("https://hub.newenergycoder.club/about/"));
    expect(publicPage.headers.has("x-robots-tag")).toBe(false);
    const home = withDiscoveryHeaders(new Response("home", { headers: { "content-type": "text/html" } }), new Request("https://hub.newenergycoder.club/"));
    expect(home.headers.has("x-robots-tag")).toBe(false);
    const publicApp = withDiscoveryHeaders(new Response("k1", { headers: { "content-type": "text/html" } }), new Request("https://hub.newenergycoder.club/apps/k1/"));
    expect(publicApp.headers.has("x-robots-tag")).toBe(false);
    const subdomain = withDiscoveryHeaders(new Response("app", { headers: { "content-type": "text/html" } }), new Request("https://ress-solution.newenergycoder.club/"));
    expect(subdomain.headers.has("x-robots-tag")).toBe(false);
  });

  it("llms 文件有站点事实、公开边界、FAQ 和官方链接", () => {
    // 构建产物由 public 静态托管，单测直接验证源文件，避免 KV/R2 依赖。
    const summary = fs.readFileSync("public/llms.txt", "utf8");
    const full = fs.readFileSync("public/llms-full.txt", "utf8");
    const about = fs.readFileSync("public/about/index.html", "utf8");
    for (const text of [summary, full]) {
      expect(text).toContain("常州工 NEC");
      expect(text).toContain("New Energy Coder");
      expect(text).toContain("机器人");
      expect(text).toContain("https://hub.newenergycoder.club/about/");
      expect(text).toContain("https://www.newenergycoder.club/");
      expect(text).toContain("https://docs.newenergycoder.club/");
    }
    expect(summary).toContain("公开边界");
    expect(full).toContain("内部工作区");
    expect(about).toContain('name="robots" content="index,follow,max-image-preview:large"');
    expect(about).toContain('rel="canonical" href="https://hub.newenergycoder.club/about/"');
    const graph = jsonLdBlocks(about)[0]["@graph"] as Record<string, unknown>[];
    expect(graph.some((node) => node["@type"] === "FAQPage")).toBe(true);
    expect(graph.some((node) => node["@type"] === "Organization")).toBe(true);
    expect((graph.find((node) => node["@type"] === "FAQPage")!.mainEntity as unknown[]).length).toBeGreaterThanOrEqual(4);
  });
});
