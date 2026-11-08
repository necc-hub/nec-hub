/// <reference types="node" />

import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { validateAppIntegration } from "../shared/app-integration";

const names = [
  "drawing-review",
  "hardware-review",
  "contract-signing",
  "reimburse",
  "compliance",
  "season-goals",
  "task-schedule",
  "domains",
  "cla-sign",
  "scoring",
  "mech-review-6014",
  "ress-solution",
  "k1",
  "drawing",
];

describe("内置应用集成声明", () => {
  it.each(names)("%s 声明合法且没有自动生产验收", (name) => {
    const raw = JSON.parse(fs.readFileSync(`web/apps/${name}/integration.json`, "utf8"));
    const integration = validateAppIntegration(raw, name);
    expect(integration.status).not.toBe("verified");
  });

  it("K1 仅 P 级静态预览，任务排期如实声明 localStorage", () => {
    const k1 = JSON.parse(fs.readFileSync("web/apps/k1/integration.json", "utf8"));
    const tasks = JSON.parse(fs.readFileSync("web/apps/task-schedule/integration.json", "utf8"));
    expect(k1.level).toBe("P");
    expect(k1.notes).toMatch(/不连接打印机/);
    expect(tasks.dataSource).toMatch(/localStorage/);
    expect(tasks.apis).toEqual([]);
  });
});
