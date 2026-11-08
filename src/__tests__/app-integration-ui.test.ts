/// <reference types="node" />

import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("应用广场集成展示", () => {
  it("三组应用卡片复用同一个集成徽章", () => {
    const component = fs.readFileSync("web/src/shared/ui/IntegrationBadge.vue", "utf8");
    const appsTab = fs.readFileSync("web/src/portal/components/tabs/AppsTab.vue", "utf8");
    expect(component).toContain("integrationBadgeModel");
    expect(component).toContain("classes[model.tone]");
    expect(appsTab.match(/<IntegrationBadge\b/g)).toHaveLength(3);
  });

  it("K1 明确显示 P 级公网静态预览", () => {
    const html = fs.readFileSync("web/apps/k1/index.html", "utf8");
    expect(html).toContain("P 级 · 公网静态预览");
    expect(html).toContain("不连接打印机");
  });

  it("发布文档与 PRD 同步 integration 契约和真实验收状态", () => {
    const prompt = fs.readFileSync("web/src/shared/prompts.ts", "utf8");
    const instructions = fs.readFileSync("src/mcp/instructions.ts", "utf8");
    const manual = fs.readFileSync("docs/APP互联互通使用手册.md", "utf8");
    const prd = fs.readFileSync("docs/团队AI中台PRD_V2.1.md", "utf8");
    expect(prompt).toContain("integration");
    expect(prompt).toContain("production");
    expect(instructions).toContain("integration");
    expect(manual).toMatch(/"integration":\s*\{/);
    expect(prd).toContain("14 个内置应用");
    expect(prd).toContain("第一阶段");
  });
});
