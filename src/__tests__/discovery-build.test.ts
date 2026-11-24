import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { PUBLIC_APP_SEO } from "../shared/discovery";

function generatedHtml(path: string): string {
  if (!fs.existsSync(path)) {
    execFileSync("npm", ["run", "build:web"], { cwd: process.cwd(), stdio: "pipe" });
  }
  return fs.readFileSync(path, "utf8");
}

describe("Vite 生成的 GEO 元数据", () => {
  it("首页有唯一描述、canonical、结构化数据和无 JS 可读正文", () => {
    const html = generatedHtml("public/index.html");
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html).toContain("常州工 NEC");
    expect(html).toContain("开源工程实践社区");
    expect(html).toContain('rel="alternate" type="text/plain" href="/llms.txt"');
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    const graph = JSON.parse(blocks[0][1])["@graph"];
    expect(graph.map((node: Record<string, unknown>) => node["@type"])).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebPage"]));
  });

  it("公开应用带规范 URL，内部应用带 noindex", () => {
    const publicApp = generatedHtml("public/apps/k1/index.html");
    expect(publicApp).toContain('rel="canonical" href="https://hub.newenergycoder.club/apps/k1/"');
    expect(publicApp).toContain('name="robots" content="index,follow,max-image-preview:large"');
    expect(publicApp.match(/name="description"/g)).toHaveLength(1);
    expect(publicApp).not.toContain('name="robots" content="noindex,nofollow,noarchive"');
    for (const app of ["reimburse", "contract-signing", "drawing-review", "domains"]) {
      const html = generatedHtml(`public/apps/${app}/index.html`);
      expect(html).toContain('name="robots" content="noindex,nofollow,noarchive"');
    }
    expect(PUBLIC_APP_SEO["ress-solution"].description).toContain("不连接实时产品服务");
  });

  it("动态版独立页也默认不索引", () => {
    const html = generatedHtml("public/apps/task-schedule/animated.html");
    expect(html).toContain('name="robots" content="noindex,nofollow,noarchive"');
  });
});
