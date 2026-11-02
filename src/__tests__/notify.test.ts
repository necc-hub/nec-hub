/**
 * 通知域测试（PRD 审批与通知中心 N-01 / 对照清单 A4）：
 * 加签向量、未配置降级、消息体形状与按流程分流、失败重试后写 notify:failed
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { atMentions, buildApprovalCard, feishuBotSign, notifyFeishu } from "../feishu/bot";
import { KV_KEYS } from "../shared/kv-keys";
import { createMockEnv } from "./mock-env";

function makeEnv(extra: Record<string, string> = {}): Env {
  return { ...createMockEnv(), ...extra } as unknown as Env;
}

function jsonFetch(data: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } }),
  );
}

describe("feishuBotSign（对齐飞书官方示例）", () => {
  it("已知向量：timestamp=1700000000, secret=test-secret", async () => {
    // 向量由 Node crypto（独立实现）预计算：HMAC-SHA256(key=`${ts}\n${secret}`, msg="") → base64
    expect(await feishuBotSign("test-secret", 1700000000)).toBe("mbm4Y4oluIPQ00qlBIhX8vAZ0EKv3nw0LuTb91jPL84=");
  });

  it("同 secret 不同 timestamp 输出不同", async () => {
    const a = await feishuBotSign("s", 1700000000);
    const b = await feishuBotSign("s", 1700000001);
    expect(a).not.toBe(b);
  });
});

describe("notifyFeishu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("未配置 webhook → 静默降级，不发请求", async () => {
    const fetchMock = jsonFetch({ code: 0 });
    vi.stubGlobal("fetch", fetchMock);
    const r = await notifyFeishu(makeEnv(), "reimburse", "标题", "正文");
    expect(r.ok).toBe(false);
    expect(r.detail).toBe("未配置 webhook");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("成功路径：msg_type/text 嵌套、按流程分流 webhook、附时间戳与签名", async () => {
    const fetchMock = jsonFetch({ code: 0 });
    vi.stubGlobal("fetch", fetchMock);
    const env = makeEnv({
      FEISHU_BOT_WEBHOOK: "https://main.example/hook",
      FEISHU_BOT_WEBHOOK_SECRET: "main-s3cret",
      FEISHU_BOT_WEBHOOK_REIMBURSE: "https://rb.example/hook",
    });
    const r = await notifyFeishu(env, "reimburse", "📋 新报销申请", "事项：打印纸", "https://link");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://rb.example/hook");
    const body = JSON.parse(init.body) as { msg_type: string; content: { text: string }; timestamp: number; sign: string };
    expect(body.msg_type).toBe("text");
    expect(body.content.text).toBe("📋 新报销申请\n事项：打印纸\n去处理：https://link");
    expect(typeof body.timestamp).toBe("number");
    expect(body.sign).toBe(await feishuBotSign("main-s3cret", body.timestamp));
  });

  it("未配 SECRET 时不带签名（timestamp/sign 缺席）", async () => {
    const fetchMock = jsonFetch({ code: 0 });
    vi.stubGlobal("fetch", fetchMock);
    const env = makeEnv({ FEISHU_BOT_WEBHOOK: "https://main.example/hook" });
    const r = await notifyFeishu(env, "reimburse", "t", "c");
    expect(r.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.timestamp ?? null).toBeNull();
    expect(body.sign ?? null).toBeNull();
  });

  it("连续 3 次失败（重试 1s/4s）→ 记录 KV notify:failed，不抛错", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(async () => {
        return new Response(JSON.stringify({ code: 19001, msg: "boom" }), { status: 200, headers: { "content-type": "application/json" } });
      });
      vi.stubGlobal("fetch", fetchMock);
      const env = createMockEnv() as unknown as Env;
      Object.assign(env, { FEISHU_BOT_WEBHOOK: "https://main.example/hook" });
      const p = notifyFeishu(env, "reimburse", "t", "c");
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(4000);
      const r = await p;
      expect(r.ok).toBe(false);
      expect(r.detail).toContain("发送失败（重试 2 次）");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const putMock = (env as unknown as ReturnType<typeof createMockEnv>).REGISTRY.put;
      const putCall = putMock.mock.calls.find((c) => c[0] === KV_KEYS.notifyFailed);
      expect(putCall).toBeDefined();
      const list = JSON.parse(putCall![1]) as Array<{ flow: string; title: string; detail: string; at: string }>;
      expect(list).toHaveLength(1);
      expect(list[0].flow).toBe("reimburse");
      expect(list[0].title).toBe("t");
      expect(list[0].detail).toContain("boom");
    } finally {
      vi.useRealTimers();
    }
  });

  it("第 1 次网络异常、第 2 次成功 → 重试后 ok 且不记录失败", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const fetchMock = vi.fn(async () => {
        calls++;
        if (calls === 1) throw new Error("network down");
        return new Response(JSON.stringify({ code: 0 }), { status: 200, headers: { "content-type": "application/json" } });
      });
      vi.stubGlobal("fetch", fetchMock);
      const env = createMockEnv() as unknown as Env;
      Object.assign(env, { FEISHU_BOT_WEBHOOK: "https://main.example/hook" });
      const p = notifyFeishu(env, "reimburse", "t", "c");
      await vi.advanceTimersByTimeAsync(1000);
      const r = await p;
      expect(r.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const putMock = (env as unknown as ReturnType<typeof createMockEnv>).REGISTRY.put;
      expect(putMock.mock.calls.some((c) => c[0] === KV_KEYS.notifyFailed)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
describe("审批卡片通知（PRD_审批通知卡片化）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("atMentions：仅保留合法 open_id，空/非法值静默过滤", () => {
    expect(atMentions(["ou_abc123", "", "bad-id", "ou_X9y", "  "])).toBe("<at user_id=ou_abc123></at> <at user_id=ou_X9y></at>");
    expect(atMentions(undefined)).toBe("");
    expect(atMentions([])).toBe("");
  });

  it("buildApprovalCard：JSON 2.0 结构、标题着色、@ 人与 open_url 按钮", () => {
    const card = buildApprovalCard({
      title: "📋 新图纸评审 DR-2026-0001",
      content: "申请人：张三",
      link: "https://link",
      atOpenIds: ["ou_abc"],
      template: "green",
    }) as {
      schema: string;
      header: { title: { content: string }; template: string };
      body: { elements: Array<{ tag: string; content?: string; behaviors?: Array<{ type: string; url: string }> }> };
    };
    expect(card.schema).toBe("2.0");
    expect(card.header.title.content).toBe("📋 新图纸评审 DR-2026-0001");
    expect(card.header.template).toBe("green");
    const md = card.body.elements[0];
    expect(md.tag).toBe("markdown");
    expect(md.content).toContain("申请人：张三");
    expect(md.content).toContain("<at user_id=ou_abc></at>");
    const btn = card.body.elements[1];
    expect(btn.tag).toBe("button");
    expect(btn.behaviors).toEqual([{ type: "open_url", url: "https://link" }]);
  });

  it("buildApprovalCard：无链接时不输出按钮", () => {
    const card = buildApprovalCard({ title: "t", content: "c" }) as { body: { elements: unknown[] } };
    expect(card.body.elements).toHaveLength(1);
  });

  it("卡片发送成功：msg_type=interactive + card 负载", async () => {
    const fetchMock = jsonFetch({ code: 0 });
    vi.stubGlobal("fetch", fetchMock);
    const env = makeEnv({ FEISHU_BOT_WEBHOOK: "https://main.example/hook" });
    const card = buildApprovalCard({ title: "t", content: "c", link: "https://link" });
    const r = await notifyFeishu(env, "reimburse", "t", "c", "https://link", { card });
    expect(r.ok).toBe(true);
    expect(r.detail).toBe("ok(card)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as { msg_type: string; card: { schema: string } };
    expect(body.msg_type).toBe("interactive");
    expect(body.card.schema).toBe("2.0");
  });

  it("卡片失败自动回退文本：最终 ok，文本含 @ 人与链接", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { msg_type: string };
        const code = body.msg_type === "interactive" ? 19001 : 0;
        return new Response(JSON.stringify({ code, msg: code === 0 ? "success" : "card unsupported" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });
      vi.stubGlobal("fetch", fetchMock);
      const env = makeEnv({ FEISHU_BOT_WEBHOOK: "https://main.example/hook" });
      const card = buildApprovalCard({ title: "t", content: "c" });
      const p = notifyFeishu(env, "reimburse", "t", "c", "https://link", { card, atOpenIds: ["ou_abc"] });
      // 卡片 3 次重试 + 文本 1 次成功
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(4000);
      const r = await p;
      expect(r.ok).toBe(true);
      expect(r.detail).toContain("卡片失败已回退文本");
      expect(fetchMock).toHaveBeenCalledTimes(4);
      const lastInit = fetchMock.mock.calls[3][1] as { body: string };
      const text = (JSON.parse(lastInit.body) as { content: { text: string } }).content.text;
      expect(text).toContain("<at user_id=ou_abc></at>");
      expect(text).toContain("去处理：https://link");
      const putMock = (env as unknown as ReturnType<typeof createMockEnv>).REGISTRY.put;
      expect(putMock.mock.calls.some((c) => c[0] === KV_KEYS.notifyFailed)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("卡片与文本均失败 → 留痕 notify:failed（详情含两侧错误）", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(async () => {
        return new Response(JSON.stringify({ code: 19001, msg: "boom" }), { status: 200, headers: { "content-type": "application/json" } });
      });
      vi.stubGlobal("fetch", fetchMock);
      const env = makeEnv({ FEISHU_BOT_WEBHOOK: "https://main.example/hook" });
      const card = buildApprovalCard({ title: "t", content: "c" });
      const p = notifyFeishu(env, "reimburse", "t", "c", undefined, { card });
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(i % 2 === 0 ? 1000 : 4000);
      }
      const r = await p;
      expect(r.ok).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(6);
      const putMock = (env as unknown as ReturnType<typeof createMockEnv>).REGISTRY.put;
      const putCall = putMock.mock.calls.find((c) => c[0] === KV_KEYS.notifyFailed);
      expect(putCall).toBeDefined();
      const list = JSON.parse(putCall![1]) as Array<{ detail: string }>;
      expect(list[0].detail).toContain("卡片：");
      expect(list[0].detail).toContain("文本：");
    } finally {
      vi.useRealTimers();
    }
  });
});
