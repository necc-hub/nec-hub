/**
 * 新增机图纸评审流程 — 路由注册
 *
 * 迁移说明（审批引擎 Phase 1，选项 A 兼容迁移）：评审单本体/状态机/群通知由
 * src/approvals 引擎承担（submitApprovalCore / runApprovalAction，单号 DR-2026-0001，
 * 引擎按「申请单号」写字段，「评审单号」= 申请单号供子表外键沿用）；本文件只做
 * 薄壳转调 + 富业务副作用（提交默认值/偏好回写、会议纪要、整改项创建、事件日志）。
 * URL 与请求/响应形状保持不变，前端零改动。
 * BOM/询价/库存/联想建议等子路由原样保留。入口骨架（配置接口 / 503 / 会话 / 401 / 500 兜底）
 * 统一由 shared/module-gateway 提供。
 */

import { ensureFlowTableLink, resolveMainTableId } from "../approvals/flows";
import { submitApprovalCore } from "../approvals/engine";
import { ROLES, resolveUserRole } from "../auth/role";
import { json, readJson } from "../shared/http";
import { handleScheduleMeeting } from "../shared/meeting.service";
import { withModuleGate, CONFIG_ADMIN_ROLES, type ModuleRouteContext } from "../shared/module-gateway";
import { routeFirst, type RouteDef } from "../shared/module-router";
import { logReviewEvent, runReviewEngineAction, type ReviewShellSpec } from "../shared/review-engine-bridge";
import { CONCLUSION_EVENTS } from "../shared/review-flow";
import { DrawingReviewAdapter } from "./adapter";
import { BoardService } from "./board.service";
import { BOMService } from "./bom.service";
import { getDrawingReviewConfig } from "./config";
import { ReviewFlowService, nextStatus, type ConclusionInput, type SubmitReviewInput } from "./flow.service";
import { InquiryService } from "./inquiry.service";
import { InventoryService } from "./inventory.service";
import { SuggestionService } from "./suggestion.service";
import type { DrawingReviewConfig } from "./types";

/** 引擎流程类型与薄壳事件日志配置（评审单动作全部走引擎 drawing_review 流程） */
const FLOW_TYPE = "drawing_review" as const;
const SHELL: ReviewShellSpec = {
  type: FLOW_TYPE,
  logTag: "drawing-review",
  eventsTable: "events",
  eventReviewField: "关联评审单",
};

/** 询价管理角色口径：报价回填与选定供应商共用 */
const INQUIRY_MANAGER_ROLE_RE = ROLES.INQUIRY_MANAGER;

export async function handleDrawingReview(request: Request, env: Env, pathname: string): Promise<Response | null> {
  return withModuleGate(
    {
      configPath: "/api/drawing-review/config",
      label: "新增机图纸评审流程",
      logTag: "drawing-review",
      getConfig: getDrawingReviewConfig,
      handleConfig,
      handler: handleAuthed,
      configRoles: CONFIG_ADMIN_ROLES,
    },
    request,
    env,
    pathname,
  );
}

async function handleAuthed(ctx: ModuleRouteContext<DrawingReviewConfig>): Promise<Response | null> {
  const { request, env, cfg, session, pathname } = ctx;
  // 主表单源：flows:config 优先，模块配置仅作回退（架构优化 #5）
  cfg.tables.reviews = await resolveMainTableId(env, FLOW_TYPE, cfg.tables.reviews ?? "");
  const adapter = new DrawingReviewAdapter(env, cfg);
  const flow = new ReviewFlowService(env, adapter);

  // 路由表（架构优化 #4）：字面量路由在前、泛型路由在后，/start 等不可能被 /{id} 吞掉
  const routes: RouteDef[] = [
    // 评审单提交（薄壳：默认值/偏好 → 引擎写单与通知；事件日志留本层）
    {
      method: "POST",
      path: "/api/drawing-review/submit",
      handler: async () => {
        const body = await readJson<Partial<SubmitReviewInput>>(request);
        if (!body) return json({ error: "请求体必须是 JSON" }, 400);
        const input: SubmitReviewInput = {
          projectId: body.projectId,
          machineName: body.machineName,
          drawingVersion: body.drawingVersion,
          designerId: body.designerId,
          drawingFiles: body.drawingFiles || [],
          designNotes: body.designNotes,
        };
        const defaults = await flow.getDefaultSubmissionValues(input, session.open_id);
        flow.assertSubmitReady(input, defaults);
        // 防呆幂等：同一用户 60s 内同项目+机型+版本的重复提交（双击/网络重试/刷新重发）直接返回已建单
        const idemKey = `review:submit:${session.open_id}:${defaults.projectId}:${defaults.machineName}:${defaults.drawingVersion}`;
        const dupId = await env.REGISTRY.get(idemKey);
        if (dupId) return json(await adapter.findReviewById(dupId));
        await ensureFlowTableLink(env, FLOW_TYPE, cfg.tables.reviews, cfg.base);
        const now = new Date().toISOString();
        const { application_id, status } = await submitApprovalCore(env, {
          type: FLOW_TYPE,
          fields: {
            评审单号: "@appId",
            项目编号: defaults.projectId,
            机型名称: defaults.machineName,
            图纸版本: defaults.drawingVersion,
            设计负责人: defaults.designerId,
            图纸文件: JSON.stringify(input.drawingFiles),
            设计说明: defaults.designNotes,
            创建时间: now,
            更新时间: now,
          },
          user: session,
          role: await resolveUserRole(env, session),
          source: "portal",
        });
        await env.REGISTRY.put(idemKey, application_id, { expirationTtl: 60 });
        await logReviewEvent(adapter, SHELL, application_id, session.open_id, "submit", "draft", status);
        await flow.saveSubmissionPreferences(input, session.open_id);
        return json(await adapter.findReviewById(application_id));
      },
    },
    {
      method: "GET",
      path: "/api/drawing-review",
      handler: async () => json(await flow.listReviews()),
    },
    {
      method: "GET",
      path: "/api/drawing-review/board",
      handler: async () => json(await new BoardService(adapter).build()),
    },
    // 开始填写（方便填写）：支持 projectId/machineName 查询参数——命中历史评审单时版本号自动递增
    {
      method: "GET",
      path: "/api/drawing-review/start",
      handler: async () => {
        const url = new URL(request.url);
        const defaults = await flow.getDefaultSubmissionValues(
          {
            projectId: url.searchParams.get("projectId") || undefined,
            machineName: url.searchParams.get("machineName") || undefined,
            drawingFiles: [],
          },
          session.open_id,
        );
        return json({ ok: true, defaults, timestamp: new Date().toISOString() });
      },
    },
    // 联想建议 API
    {
      method: "GET",
      path: "/api/drawing-review/suggestions",
      handler: async () => {
        const url = new URL(request.url);
        const query = url.searchParams.get("q") || "";
        const type = url.searchParams.get("type") || "all"; // project | machine | all
        const projectId = url.searchParams.get("projectId") || undefined;
        const machineName = url.searchParams.get("machineName") || undefined;

        const suggestionService = new SuggestionService(adapter);
        const context = { projectId, machineName };

        let suggestions;
        if (type === "all") {
          suggestions = await suggestionService.getSuggestions(context, query);
        } else if (type === "project") {
          const projectSuggestions = await adapter.getProjectSuggestions(query, 10);
          suggestions = projectSuggestions.map(p => ({ type: "project" as const, value: p, label: `项目: ${p}` }));
        } else if (type === "machine") {
          const machineSuggestions = await adapter.getMachineSuggestions(query, 10);
          suggestions = machineSuggestions.map(m => ({ type: "machine" as const, value: m, label: `机型: ${m}` }));
        }

        return json({ ok: true, suggestions, query, type, timestamp: new Date().toISOString() });
      },
    },
    // 询价单：生成（幂等）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/inquiries\/generate$/,
      handler: async (m) => {
        const body = (await request.json().catch(() => ({}))) as import("./inquiry.service").GenerateInquiriesInput;
        const svc = new InquiryService(env, adapter);
        return json(await svc.generate(m![1], body, session.open_id));
      },
    },
    // 询价单：比价建议书 + 可选选定（selections: {物料编码|物料项ID: inquiryId}）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/inquiries\/compare$/,
      handler: async (m) => {
        const body = (await request.json().catch(() => ({}))) as { selections?: Record<string, string> };
        const svc = new InquiryService(env, adapter);
        if (body.selections && Object.keys(body.selections).length > 0) {
          const role = await resolveUserRole(env, session);
          if (!INQUIRY_MANAGER_ROLE_RE.test(role.role)) {
            return json({ error: `权限不足：选定供应商仅队长/采购/项目经理可执行（当前角色：${role.role}）` }, 403);
          }
        }
        return json(await svc.compare(m![1], body.selections, session.open_id));
      },
    },
    // 询价单：供应商报价回填（需管理角色；报价模拟供应商提交，故收口到队长/采购/项目经理）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/inquiries\/([^/]+)\/quote$/,
      handler: async (m) => {
        const role = await resolveUserRole(env, session);
        if (!INQUIRY_MANAGER_ROLE_RE.test(role.role)) {
          return json({ error: `权限不足：报价回填仅队长/采购/项目经理可执行（当前角色：${role.role}）` }, 403);
        }
        const body = await readJson<import("./inquiry.service").QuoteInput>(request);
        if (!body) return json({ error: "请求体必须是 JSON" }, 400);
        const svc = new InquiryService(env, adapter);
        return json(await svc.quote(m![1], body, session.open_id));
      },
    },
    // 询价单：按评审单查询
    {
      method: "GET",
      path: /^\/api\/drawing-review\/([^/]+)\/inquiries$/,
      handler: async (m) => json(await adapter.listInquiries(m![1])),
    },
    // 库存：手动导入兜底（ERP/MES 未就绪，PRD §13.7）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/inventory\/import$/,
      handler: async (m) => {
        const review = await flow.getReview(m![1]);
        if (!review) return json({ error: "评审单不存在" }, 404);
        const body = (await request.json().catch(() => ({}))) as { rows?: unknown };
        if (!Array.isArray(body.rows) || body.rows.length === 0) {
          return json({ error: "rows 必须是非空数组" }, 400);
        }
        const svc = new InventoryService(adapter);
        return json(await svc.importRows(m![1], body.rows, session.open_id));
      },
    },
    // 库存：按评审单查询
    {
      method: "GET",
      path: /^\/api\/drawing-review\/([^/]+)\/inventory$/,
      handler: async (m) => json(await adapter.listInventoryByReview(m![1])),
    },
    // 会议预约（薄壳：建会与会议信息回写不变；start_meeting 状态流转走引擎）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/meeting$/,
      handler: async (m) => handleScheduleMeeting(
        request,
        env,
        {
          flow: {
            getReview: (reviewId) => adapter.findReviewById(reviewId),
            startMeeting: async (reviewId, _actorId, payload) => {
              const current = await adapter.findReviewById(reviewId);
              if (!current) throw new Error(`评审单 ${reviewId} 不存在`);
              if (!(await nextStatus(env, current.status, "start_meeting"))) {
                throw new Error(`当前状态 ${current.status} 不允许开始会议`);
              }
              await ensureFlowTableLink(env, FLOW_TYPE, cfg.tables.reviews, cfg.base);
              await runReviewEngineAction(env, SHELL, adapter, reviewId, "start_meeting", session, await resolveUserRole(env, session), payload);
              return adapter.findReviewById(reviewId);
            },
          },
          adapter,
          topic: (review) => `新增机图纸评审 - ${review.machineName} - ${review.drawingVersion}`,
        },
        m![1],
        session.open_id,
      ),
    },
    // 会议纪要
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/minutes$/,
      handler: async (m) => {
        const body = await readJson<Parameters<ReviewFlowService["saveMinutes"]>[1]>(request);
        if (!body) return json({ error: "请求体必须是 JSON" }, 400);
        return json(await flow.saveMinutes(m![1], body, session.open_id));
      },
    },
    // 评审结论（薄壳：状态流转走引擎；结论字段回写 + 整改项创建 + 事件日志留本层）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/conclusion$/,
      handler: async (m) => {
        const body = await readJson<ConclusionInput>(request);
        if (!body) return json({ error: "请求体必须是 JSON" }, 400);
        const reviewId = m![1];
        const current = await adapter.findReviewById(reviewId);
        if (!current) throw new Error(`评审单 ${reviewId} 不存在`);
        if (current.status !== "in_review") throw new Error("只能在评审中状态下提交评审结论");
        const event = CONCLUSION_EVENTS[body.conclusion];
        if (!event) throw new Error(`结论 ${body.conclusion} 无法驱动状态流转`);
        await ensureFlowTableLink(env, FLOW_TYPE, cfg.tables.reviews, cfg.base);
        await runReviewEngineAction(
          env, SHELL, adapter, reviewId, event, session, await resolveUserRole(env, session),
          { conclusion: body.conclusion }, "conclude",
        );
        const updated = await adapter.updateReview(current.recordId, {
          conclusion: body.conclusion,
          conclusionNotes: body.notes,
          updatedAt: new Date().toISOString(),
        });
        if (body.conclusion === "conditional" && body.issues && body.issues.length > 0) {
          await Promise.all(
            body.issues.map((issue) =>
              adapter.createRecord("rectifications", {
                关联评审单: reviewId,
                问题描述: issue.description,
                提出人: issue.raisedBy.open_id,
                责任人: issue.owner?.open_id,
                截止日期: issue.dueDate,
                完成状态: "未完成",
              }),
            ),
          );
        }
        return json(updated);
      },
    },
    // 整改完成（薄壳：complete 流转走引擎；事件日志动作名沿用 complete_rectification）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/rectify$/,
      handler: async (m) => {
        const reviewId = m![1];
        const current = await adapter.findReviewById(reviewId);
        if (!current) throw new Error(`评审单 ${reviewId} 不存在`);
        if (!(await nextStatus(env, current.status, "complete"))) throw new Error(`当前状态 ${current.status} 不允许完成整改`);
        await ensureFlowTableLink(env, FLOW_TYPE, cfg.tables.reviews, cfg.base);
        await runReviewEngineAction(
          env, SHELL, adapter, reviewId, "complete", session, await resolveUserRole(env, session),
          undefined, "complete_rectification",
        );
        return json(await adapter.findReviewById(reviewId));
      },
    },
    // BOM 生成（幂等：已有 BOM 直接返回；仅当状态机允许时才流转 assessing）
    {
      method: "POST",
      path: /^\/api\/drawing-review\/([^/]+)\/bom\/generate$/,
      handler: async (m) => {
        const body = await readJson<import("./bom.service").GenerateBOMInput>(request);
        if (!body) return json({ error: "请求体必须是 JSON" }, 400);
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return json({ error: "BOM 物料清单不能为空：items 至少包含一项物料" }, 400);
        }
        const existing = await adapter.getBOMByReview(m![1]);
        if (existing) return json({ ...existing, existed: true });
        const bomService = new BOMService(adapter);
        const result = await bomService.generate(m![1], body);
        // 仅 bom_generating 状态允许 generated 事件；其它状态（如补录 BOM）只写数据不流转
        const review = await flow.getReview(m![1]);
        if (review && (await nextStatus(env, review.status, "generated"))) {
          await ensureFlowTableLink(env, FLOW_TYPE, cfg.tables.reviews, cfg.base);
          await runReviewEngineAction(env, SHELL, adapter, m![1], "generated", session, await resolveUserRole(env, session));
        }
        return json(result);
      },
    },
    // BOM 查询
    {
      method: "GET",
      path: /^\/api\/drawing-review\/([^/]+)\/bom$/,
      handler: async (m) => {
        const data = await adapter.getBOMByReview(m![1]);
        if (!data) return json({ error: "BOM 不存在" }, 404);
        return json(data);
      },
    },
    // 机械加工件 BOM
    {
      method: "GET",
      path: /^\/api\/drawing-review\/([^/]+)\/bom\/machining$/,
      handler: async (m) => json(await new BOMService(adapter).extractMachiningItems(m![1])),
    },
    // 基于任务的智能联想
    {
      method: "GET",
      path: /^\/api\/drawing-review\/([^\/]+)\/task-suggestions$/,
      handler: async (m) => {
        const suggestionService = new SuggestionService(adapter);
        const suggestions = await suggestionService.getTaskBasedSuggestions(m![1]);
        return json({ ok: true, reviewId: m![1], suggestions, timestamp: new Date().toISOString() });
      },
    },
    // 评审单详情（泛型兜底，必须最后注册）
    {
      method: "GET",
      path: /^\/api\/drawing-review\/([^/]+)$/,
      handler: async (m) => {
        const review = await flow.getReview(m![1]);
        if (!review) return json({ error: "评审单不存在" }, 404);
        return json(review);
      },
    },
  ];

  return routeFirst(routes, request, pathname);
}

async function handleConfig(request: Request, env: Env): Promise<Response> {
  const body = (await readJson<{ action?: string; base?: string; tables?: Record<string, string> }>(request)) ?? {};
  if (body.action === "get" || !body.action) {
    const cfg = await getDrawingReviewConfig(env);
    return json({ configured: !!cfg, base: cfg?.base ?? null, tables: cfg?.tables ?? {} });
  }
  if (body.action !== "set") return json({ error: "action 必须是 get | set" }, 400);
  if (!body.base || !body.tables) return json({ error: "缺少 base 或 tables" }, 400);

  const { setDrawingReviewConfig } = await import("./config");
  const cfg = await setDrawingReviewConfig(env, { base: body.base, tables: body.tables as DrawingReviewConfig["tables"] });
  return json({ ok: true, config: cfg });
}
