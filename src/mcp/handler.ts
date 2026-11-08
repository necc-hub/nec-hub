/**
 * MCP (JSON-RPC over streamable HTTP) — 端点与 tools/call 分发
 *
 * 协议元数据可公开；业务工具按 readOnly 与管理/用户权限分层。
 * hasMcpToken 只在 Bearer 与 MCP_TOKEN 成功匹配时为真，readOnly 不代表公开或管理员。
 * 无效 Bearer 一律 401，写工具无管理身份时 fail-closed。
 */

import { json } from "../shared/http";
import { SERVER_INSTRUCTIONS } from "./instructions";
import { findTool, READONLY_TOOLS, TOOLS } from "./registry";

function rpc(id: string | number | null, result: unknown): Response {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } }, 200);
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  return crypto.subtle.timingSafeEqual(ab, bb);
}

export async function handleMcp(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const hasMcpToken = env.MCP_TOKEN ? await timingSafeEqual(supplied, env.MCP_TOKEN) : false;
  if (authorization && !hasMcpToken) {
    return json({ error: "unauthorized" }, 401);
  }

  let msg: {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };
  try {
    msg = (await request.json()) as typeof msg;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const id = msg.id ?? null;
  switch (msg.method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "NEC-MCP", version: "0.4.0" },
        instructions: SERVER_INSTRUCTIONS,
      });
    case "ping":
      return rpc(id, {});
    case "notifications/initialized":
      return new Response(null, { status: 202 });
    case "tools/list":
      return rpc(id, { tools: TOOLS });
    case "tools/call":
      return await callTool(id, msg.params ?? {}, env, request, hasMcpToken);
    default:
      return rpcError(id, -32601, `Method not found: ${String(msg.method)}`);
  }
}

async function callTool(
  id: string | number | null,
  params: Record<string, unknown>,
  env: Env,
  request: Request,
  hasMcpToken: boolean,
): Promise<Response> {
  const name = params.name as string;
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const tool = findTool(name);
  if (!tool) {
    return rpcError(id, -32602, `Unknown tool: ${name}`);
  }
  if (!hasMcpToken && !READONLY_TOOLS.has(name)) {
    console.warn(`[mcp] 非管理端拒绝写工具调用: ${name}`);
    return rpcError(
      id,
      -32000,
      `工具 ${name} 为写操作：需要有效 MCP_TOKEN；只读工具仍按各自用户权限执行`,
    );
  }
  try {
    return rpc(id, await tool.impl(args, env, { request, hasMcpToken }));
  } catch (err) {
    return rpc(id, {
      content: [{ type: "text", text: `执行失败：${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    });
  }
}
