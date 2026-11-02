/**
 * 飞书群自定义机器人 webhook（共享层）
 *
 * 加签算法（对齐官方示例）：把 `${timestamp}\n${secret}` 作为 HMAC-SHA256 密钥，对空内容签名，Base64 输出。
 * 消息体协议：bot/v2/hook 要求 `msg_type` 字段，text 嵌套在 `content` 里。
 *
 * 接口：
 *   - sendFeishuBotText(webhook, text, secret?) — 低层单次发送，失败抛错（FE-05 校验推送、图纸评审通知用）
 *   - sendFeishuBotCard(webhook, card, secret?) — interactive 卡片低层发送；buildApprovalCard 构造审批卡片（JSON 2.0）
 *   - atMentions(openIds) — <at user_id=ou_xxx> 片段（自定义机器人仅支持 open_id @ 人）
 *   - resolveFlowWebhook(env, flow) — 流程专属 webhook 优先，回退 BOT 主群与旧版 FEISHU_WEBHOOK_URL 主群
 *   - notifyFeishu(env, flow, title, content, link?, opts?) — 使用统一映射发送，失败重试 2 次（1s、4s）并留痕 KV notify:failed；
 *     未配置 webhook 时降级返回不抛错；opts.card 提供时先发卡片、失败自动回退文本；opts.atOpenIds @ 指定人
 */

import { KV_KEYS } from "../shared/kv-keys";
import { envSecret } from "./client";

/** 飞书加签：HMAC-SHA256(`${timestamp}\n${secret}`) → Base64 */
export async function feishuBotSign(secret: string, timestamp: number): Promise<string> {
  // 飞书官方算法：把 `${timestamp}\n${secret}` 作为 HMAC 密钥，对空内容签名（官方 Python 示例即 hmac.new(string_to_sign, digestmod=sha256)）
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${timestamp}\n${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new Uint8Array(0));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** 发送 text 消息到群机器人 webhook；配置 secret 时带加签；失败（code!==0）抛错 */
export async function sendFeishuBotText(webhookUrl: string, text: string, secret?: string): Promise<void> {
  const body: Record<string, unknown> = { msg_type: "text", content: { text } };
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    body.timestamp = timestamp;
    body.sign = await feishuBotSign(secret, timestamp);
  }
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as { code?: number; msg?: string };
  if (data.code !== 0) throw new Error(`飞书群机器人推送失败：${data.msg ?? `code ${data.code}`}`);
}

/** 通知失败记录（KV notify:failed，7 天 TTL，截断 100 条，管理端可查） */
export async function recordNotifyFailure(env: Env, flow: string, title: string, detail: string): Promise<void> {
  try {
    const raw = await env.REGISTRY.get(KV_KEYS.notifyFailed);
    let list: Array<{ flow: string; title: string; detail: string; at: string }> = [];
    try {
      list = raw ? (JSON.parse(raw) as typeof list) : [];
    } catch {
      list = [];
    }
    list.unshift({ flow, title, detail, at: new Date().toISOString() });
    await env.REGISTRY.put(KV_KEYS.notifyFailed, JSON.stringify(list.slice(0, 100)), { expirationTtl: 7 * 24 * 3600 });
  } catch {
    /* 记录失败不阻断主流程 */
  }
}

/** @ 人片段：自定义机器人仅支持 open_id @ 指定人（官方 FAQ）；非法/空值静默过滤 */
export function atMentions(openIds?: string[]): string {
  return (openIds ?? [])
    .map((id) => id.trim())
    .filter((id) => /^ou_[A-Za-z0-9]+$/.test(id))
    .map((id) => `<at user_id=${id}></at>`)
    .join(" ");
}

/** 发送 interactive 消息卡片到群机器人 webhook；配置 secret 时带加签；失败（code!==0）抛错 */
export async function sendFeishuBotCard(webhookUrl: string, card: object, secret?: string): Promise<void> {
  const body: Record<string, unknown> = { msg_type: "interactive", card };
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    body.timestamp = timestamp;
    body.sign = await feishuBotSign(secret, timestamp);
  }
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as { code?: number; msg?: string };
  if (data.code !== 0) throw new Error(`飞书群机器人卡片推送失败：${data.msg ?? `code ${data.code}`}`);
}

/** 审批通知卡片（卡片 JSON 2.0）：标题着色 + 字段 markdown + @ 人 + 「去处理」URL 跳转按钮。
 *  自定义机器人卡片不支持请求回调交互（官方《配置卡片交互》），按钮只能 open_url。 */
export function buildApprovalCard(input: {
  title: string;
  content: string;
  link?: string;
  atOpenIds?: string[];
  /** 头部颜色模板：blue=待审 green=通过 red=驳回 wathet=中间态 */
  template?: string;
}): object {
  const at = atMentions(input.atOpenIds);
  const elements: object[] = [
    { tag: "markdown", content: input.content + (at ? `\n${at}` : "") },
  ];
  if (input.link) {
    elements.push({
      tag: "button",
      text: { tag: "plain_text", content: "去处理" },
      type: "primary",
      behaviors: [{ type: "open_url", url: input.link }],
    });
  }
  return {
    schema: "2.0",
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: input.title },
      template: input.template ?? "blue",
    },
    body: { elements },
  };
}

export interface FlowWebhook {
  url?: string;
  secret?: string;
}

/** 按流程解析 webhook：流程专属配置优先，其后依次回退 BOT 主群与旧版主群。
 *  命名规则：FEISHU_BOT_WEBHOOK_<FLOW 大写>（drawing_review → FEISHU_BOT_WEBHOOK_DRAWING_REVIEW，
 *  hardware_review → FEISHU_BOT_WEBHOOK_HARDWARE_REVIEW，contract → FEISHU_BOT_WEBHOOK_CONTRACT）。 */
export function resolveFlowWebhook(env: Env, flow: string): FlowWebhook {
  const flowKey = flow.toUpperCase();
  const flowUrl = envSecret(env, `FEISHU_BOT_WEBHOOK_${flowKey}`);
  const flowSecret = envSecret(env, `FEISHU_BOT_WEBHOOK_${flowKey}_SECRET`);
  if (flowUrl !== undefined) {
    return { url: flowUrl, secret: flowSecret ?? env.FEISHU_BOT_WEBHOOK_SECRET };
  }
  if (env.FEISHU_BOT_WEBHOOK !== undefined) {
    return { url: env.FEISHU_BOT_WEBHOOK, secret: env.FEISHU_BOT_WEBHOOK_SECRET };
  }
  return { url: env.FEISHU_WEBHOOK_URL, secret: env.FEISHU_WEBHOOK_SECRET };
}

/**
 * 飞书群机器人 webhook 通知（PRD V1.1 N-01）。
 * 失败（网络异常/code!==0）重试 2 次（1s、4s），仍失败写 KV notify:failed；调用方不抛错。
 * opts.card 提供时先发卡片（PRD_审批通知卡片化）；卡片发送失败自动回退纯文本，保证不丢通知。
 * opts.atOpenIds 在文本与卡片中均会 @ 对应人（open_id）。
 */
export async function notifyFeishu(
  env: Env,
  flow: string,
  title: string,
  content: string,
  link?: string,
  opts?: { card?: object; atOpenIds?: string[] },
): Promise<{ ok: boolean; detail: string }> {
  const { url, secret } = resolveFlowWebhook(env, flow);
  if (!url) return { ok: false, detail: "未配置 webhook" };
  const at = atMentions(opts?.atOpenIds);
  const text = title + "\n" + content + (at ? "\n" + at : "") + (link ? "\n去处理：" + link : "");

  const sendWithRetry = async (send: () => Promise<void>): Promise<string | null> => {
    let attempt = 0;
    let lastErr = "";
    while (attempt < 3) {
      attempt++;
      try {
        await send();
        return null;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt === 1 ? 1000 : 4000));
    }
    return lastErr;
  };

  if (opts?.card) {
    const cardErr = await sendWithRetry(() => sendFeishuBotCard(url, opts.card!, secret));
    if (cardErr === null) return { ok: true, detail: "ok(card)" };
    // 卡片失败回退文本；文本也失败才留痕（留痕详情合并两侧错误）
    const textErr = await sendWithRetry(() => sendFeishuBotText(url, text, secret));
    if (textErr === null) return { ok: true, detail: `卡片失败已回退文本：${cardErr}` };
    await recordNotifyFailure(env, flow, title, `卡片：${cardErr}；文本：${textErr}`);
    return { ok: false, detail: `发送失败（重试 2 次）：卡片 ${cardErr}；文本 ${textErr}` };
  }

  const textErr = await sendWithRetry(() => sendFeishuBotText(url, text, secret));
  if (textErr === null) return { ok: true, detail: "ok" };
  await recordNotifyFailure(env, flow, title, textErr);
  return { ok: false, detail: `发送失败（重试 2 次）：${textErr}` };
}
