import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isCatalogEligible } from '../src/shared/app-catalog'
import { HUB_ORIGIN, PUBLIC_APP_SEO } from '../src/shared/discovery'
import { validateAppIntegration } from '../src/shared/app-integration'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

// 构建前清空旧 hash 产物：emptyOutDir 只清 outDir 根（会误删 brand/ docs/ assets/ 手写资源），故只清 portal-assets
function cleanPortalAssets() {
  return {
    name: 'clean-portal-assets',
    apply: 'build' as const,
    buildStart() {
      fs.rmSync(path.resolve(ROOT, '../public/portal-assets'), { recursive: true, force: true })
    },
  }
}

// 仓内官方子应用的展示元数据（原 AppsTab 硬编码迁移至此，构建期下发 manifest，应用广场不再手写入口）
// group: core=核心流程 standalone=独立应用；新应用未登记时按 <title> 兜底、归 standalone
// deprecated: true 的应用（当前为 drawing，已被 drawing-review 取代）不上架：源码与 /apps/<name>/ 保留可访问
const BUILTIN_APP_META: Record<string, { group: 'core' | 'standalone'; title: string; desc: string; icon: string; deprecated?: boolean }> = {
  'drawing-review': { group: 'core', title: '新增机图纸评审', desc: '提交 · 评审 · BOM · 排期 · 采购', icon: '📐' },
  'hardware-review': { group: 'core', title: '硬件评审流程', desc: '选型 · 评审 · 立项 · 归档', icon: '🔧' },
  'mech-review-6014': { group: 'core', title: '6014 电机机械评审', desc: '评审纪要 · 转接板草图 · DXF/CSV', icon: '⚙️' },
  scoring: { group: 'core', title: 'NEC 评分看板', desc: '赛事成绩 · 评分记录 · 排名', icon: '🏆' },
  'contract-signing': { group: 'core', title: '协议签署 OA 审批', desc: '合同提交 · 会签审批 · 归档', icon: '📝' },
  domains: { group: 'core', title: '域名分发系统', desc: '子域名申请 · 分发管理', icon: '🌐' },
  reimburse: { group: 'standalone', title: '报销助手', desc: '费用报销单 · 发票附件 · 提交审批', icon: '💰' },
  compliance: { group: 'standalone', title: '合规申请', desc: '合规事项提交 · 审批 · 归档', icon: '🛡️' },
  'cla-sign': { group: 'standalone', title: 'CLA 协议签署', desc: '开源贡献协议 · 签署 · PDF 证书', icon: '✍️' },
  drawing: { group: 'standalone', title: '机械图纸审批（已废弃）', desc: '旧轻审批线已下线，请使用「新增机图纸评审」', icon: '📏', deprecated: true },
  'season-goals': { group: 'standalone', title: '赛季目标管理', desc: '目标 · 关键结果 · 完成度跟踪', icon: '🎯' },
  'task-schedule': { group: 'standalone', title: '任务排期', desc: '任务计划 · 排期甘特 · 进度', icon: '🗓️' },
  'ress-solution': { group: 'standalone', title: 'StarCharge RESS 场景方案', desc: '场景视频 · 产品包 BOM · 配置导出', icon: '🔋' },
  k1: { group: 'standalone', title: 'K1 Dashboard', desc: '设备状态 · 温度趋势 · 打印历史 · 床网数据', icon: '🖨️' },
}
const BUILTIN_APP_ORDER = Object.keys(BUILTIN_APP_META)

function builtinManifestEntries() {
  const appsDir = path.resolve(ROOT, 'apps')
  if (!fs.existsSync(appsDir)) return []
  const names = fs.readdirSync(appsDir).filter((name) => {
    const dir = path.join(appsDir, name)
    return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, 'index.html'))
  })
  const ordered = [...BUILTIN_APP_ORDER.filter((n) => names.includes(n)), ...names.filter((n) => !BUILTIN_APP_META[n]).sort()]
  return ordered.flatMap((name) => {
    const meta = BUILTIN_APP_META[name]
    const integration = validateAppIntegration(JSON.parse(fs.readFileSync(path.join(appsDir, name, 'integration.json'), 'utf8')), name)
    // deprecated 双保险：integration.json 与 META 任一处标记即不上架
    if (!isCatalogEligible({ name, integration }) || meta?.deprecated) return []
    let title = name
    if (!meta) {
      const html = fs.readFileSync(path.join(appsDir, name, 'index.html'), 'utf-8')
      title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/\s*·\s*NEC HUB\s*$/, '').trim() || name
    }
    return [{ name, title: meta?.title ?? title, desc: meta?.desc ?? '', icon: meta?.icon ?? '🧩', group: meta?.group ?? 'standalone', integration }]
  })
}

// 构建期生成 public/apps/builtin.json（Worker 读它合并应用广场）；dev 下由中间件实时提供
function builtinAppsManifest() {
  const outFile = () => path.resolve(ROOT, '../public/apps/builtin.json')
  const json = () => JSON.stringify(builtinManifestEntries(), null, 2)
  return {
    name: 'builtin-apps-manifest',
    writeBundle() {
      fs.mkdirSync(path.dirname(outFile()), { recursive: true })
      fs.writeFileSync(outFile(), json())
    },
    configureServer(server: { middlewares: { use: (route: string, fn: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) => void) => void } }) {
      server.middlewares.use('/apps/builtin.json', (_req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(json())
      })
    },
  }
}

// MPA 入口自动发现：门户 index.html + apps/*/index.html，新增子应用零配置（避免并行开发改 vite.config 冲突）
function discoverEntries() {
  const entries: Record<string, string> = { main: path.resolve(ROOT, 'index.html') }
  const appsDir = path.resolve(ROOT, 'apps')
  if (fs.existsSync(appsDir)) {
    for (const name of fs.readdirSync(appsDir)) {
      const html = path.join(appsDir, name, 'index.html')
      if (fs.statSync(path.join(appsDir, name)).isDirectory() && fs.existsSync(html)) {
        entries['apps/' + name] = html
      }
    }
    // 非 index 的独立静态页（task-schedule/animated.html 动态版）也进构建，彻底下线 Tailwind CDN
    const animated = path.join(appsDir, 'task-schedule', 'animated.html')
    if (fs.existsSync(animated)) entries['apps/task-schedule/animated'] = animated
  }
  return entries
}

/**
 * GEO/SEO：公开页面由共享清单声明，内部应用构建期默认 noindex。
 * 清单、llms.txt、JSON-LD 与 sitemap 保持同一套公开边界；新增公开页必须同步登记。
 */
function discoveryMetadata() {
  return {
    name: 'discovery-metadata',
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string, ctx: { filename: string }) {
        const appRelative = ctx.filename.split('/apps/')[1]
        const app = appRelative?.split('/')[0]
        const isAppIndex = Boolean(app && appRelative === `${app}/index.html`)
        const pathname = app ? `/apps/${app}${isAppIndex ? '/' : `/${appRelative!.split('/').slice(1).join('/')}`}` : '/'
        const publicMeta = isAppIndex ? PUBLIC_APP_SEO[app!] : undefined
        const isPublic = !app || Boolean(publicMeta)
        const pageTitle = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim()
        const title = pageTitle || publicMeta?.title || 'NEC Hub｜常州工 NEC 团队协作与应用入口'
        const description = publicMeta?.description ?? '常州工 NEC 的团队协作与应用入口：聚合公开项目、Skill、品牌资产与开源仓库。登录后的任务、审批、财务和评审属于内部工作区。'
        const tags = [
          ...(html.match(/<meta\s+name=["']description["']/i)
            ? []
            : [{ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' as const }]),
          { tag: 'meta', attrs: { name: 'robots', content: isPublic ? 'index,follow,max-image-preview:large' : 'noindex,nofollow,noarchive' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { name: 'author', content: '常州工 NEC' }, injectTo: 'head' as const },
          { tag: 'link', attrs: { rel: 'canonical', href: HUB_ORIGIN + pathname }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:locale', content: 'zh_CN' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:site_name', content: 'NEC Hub · 常州工 NEC' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:url', content: HUB_ORIGIN + pathname }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image', content: `${HUB_ORIGIN}/assets/nec-social-card.jpg` }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { name: 'twitter:image', content: `${HUB_ORIGIN}/assets/nec-social-card.jpg` }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { name: 'theme-color', content: '#102A43' }, injectTo: 'head' as const },
          { tag: 'link', attrs: { rel: 'alternate', type: 'text/plain', href: '/llms.txt', title: 'NEC Hub AI-readable summary' }, injectTo: 'head' as const },
        ]
        if (!isPublic) return { html, tags }

        const webPage = {
          '@type': 'WebPage', '@id': `${HUB_ORIGIN}${pathname}#webpage`, url: `${HUB_ORIGIN}${pathname}`,
          name: title, description, inLanguage: 'zh-CN', isPartOf: { '@id': `${HUB_ORIGIN}/#website` },
          about: { '@id': `${HUB_ORIGIN}/#organization` }, dateModified: '2026-11-25',
        }
        const graph: Record<string, unknown>[] = app ? [webPage] : [
          {
            '@type': 'Organization', '@id': `${HUB_ORIGIN}/#organization`, name: '常州工 NEC',
            alternateName: ['NEC', 'New Energy Coder', '新能源编程俱乐部'],
            description: '发起于常州工学院、面向学生与青年工程师的开源工程实践社区，聚焦机器人、嵌入式与新能源。',
            url: 'https://www.newenergycoder.club/', logo: `${HUB_ORIGIN}/brand/nec-logo.svg`,
            sameAs: ['https://www.newenergycoder.club/', 'https://docs.newenergycoder.club/', 'https://github.com/necc-hub', 'https://gitee.com/darrenpig/new_energy_coder_club'],
          },
          {
            '@type': 'WebSite', '@id': `${HUB_ORIGIN}/#website`, url: `${HUB_ORIGIN}/`,
            name: 'NEC Hub', alternateName: '常州工 NEC 团队协作与应用入口', inLanguage: 'zh-CN',
            publisher: { '@id': `${HUB_ORIGIN}/#organization` }, description,
          },
          webPage,
        ]
        const structuredData = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`
        return { html: html.replace('</head>', `${structuredData}\n</head>`), tags }
      },
    },
  }
}

export default defineConfig({
  // 模板里的 /brand/* 等绝对路径由 Worker 静态托管，交给运行时解析，不进 bundle
  plugins: [vue({ template: { transformAssetUrls: false } }), tailwindcss(), cleanPortalAssets(), builtinAppsManifest(), discoveryMetadata()],
  resolve: {
    alias: {
      '@shared': path.resolve(ROOT, 'src/shared'),
      '@portal': path.resolve(ROOT, 'src/portal'),
      '@apps': path.resolve(ROOT, 'src/apps'),
    },
  },
  build: {
    // 直出到 Worker 静态目录：public/index.html（门户）+ public/apps/<name>/index.html（子应用）
    // emptyOutDir=false：绝不清空 public/（brand/ docs/ assets/ 与其余子应用静态资源共存）
    // 旧 hash 文件由 cleanPortalAssets 插件在 buildStart 清除，无需人工删除
    outDir: '../public',
    emptyOutDir: false,
    assetsDir: 'portal-assets',
    rollupOptions: { input: discoverEntries() },
  },
})
