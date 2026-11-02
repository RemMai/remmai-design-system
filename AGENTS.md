# RMDL v0.4 — All-Agent Policy (Codex / OpenCode / Claude Code)

本仓库唯一 Agent 规则入口。所有根 Agent、Worker、Reviewer 都必须遵循；根 Agent 派发子任务时显式传达相同约束、允许写入范围和验收标准。**提示词约束不能替代 GitHub 权限、CI、发布控制和用户审批。**

## 0. 首先判定仓库类型

- **RMDL 主仓库**（有 `registry/components.json`、`RMDL.md`、`packages/ui`）：维护规范、组件资产、构建和发布；**没有**业务 `rmdl.project.json` 是正常的。必须运行 `node scripts/check-repo.mjs` 和相关组件测试；不能拿 `scripts/rmdl.mjs check` 当主库自身的门禁。
- **业务仓库**（有 `rmdl.project.json`，可有 `vendor/rmdl`）：在已锁定选型下实现业务；必须运行已固定版本的 `rmdl.mjs check` + 真实业务 typecheck、lint、test、build、visual。若未锁定，除了选型/审计工作不得自行开发。

## 1. 规范优先级

遵守平台与用户更高优先级要求；在项目技术规范内部按：

1. 本仓库 `RMDL.md` 中的强制红线和 `docs/02-前端视觉与页面契约.md`。
2. `docs/06-跨Agent统一接入.md`、`docs/07-组件注册晋升.md`、`docs/12-决策与版本治理.md`。
3. `registry/components.json` 中已真实发布、已由所有者批准的公共组件契约。
4. 业务仓库已批准的 `rmdl.project.json`、实际项目技术限制与领域约定（**不能放宽前述红线**）。

只读任务按需加载文档；不要每次扫描所有文档或全部源码。冲突时停止冲突部分，向所有者报告具体差异、影响与可选解决方案。

## 2. 不可违反的工程红线

1. Web 前端统一 React、TypeScript strict、Bun、HeroUI v3、Tailwind v4、Lucide、RMDL Tokens；前端形态 (Vite/Next 等) 由已批准的项目选型决定。
2. 所有基础布局、页面容器、表格、表单、弹窗等，优先使用 RMDL 已批准且已发布的**同一共享包版本**。不准创建另一套设计系统或引入 Ant Design/MUI/Chakra/Mantine/Bootstrap/PrimeReact 等第二套 UI。
3. 业务页面不得私自复制公共组件源码、使用深层 CSS/`!important` 越权覆写公共设计、硬编码另一套全局颜色/间距/字号等。
4. 初始化/整体重构：**先审计/展示选型 → 用户明确批准 → 锁定配置 → 执行**。后端语言可选，但必须满足层次边界；.NET ORM 以 FreeSql + CodeFirst 为默认，EF Core 需例外审批，Dapper 仅辅助查询。
5. 不允许自行修改规范、选型锁、Tokens、Registry 审批状态、发布流程、质量门禁与 Golden 截图，以使任务“通过”。
6. 所有者批准必须有可信的 PR/Issue/明确人工决定记录。**Agent 填写 `approvedBy` 不等于取得审批**。
7. UI 文案简短与纯净操作原则（严禁 AI 废话与功能复述）：
   - **禁止宣讲式卡片**：严禁在页面底部、侧边或空闲区添加“功能介绍”、“核心特性”、“使用说明”、“本模块支持以下功能”等回显用户 Prompt 的宣讲式卡片、特性网格或操作说明书。
   - **后台即工作台 (Console Only)**：界面定位为高信息密度的专业工作台，不是营销落地页 (Landing Page)。只保留数据表格、表单控件与直接操作按钮。
   - **帮助文案边界**：说明文案仅允许出现在输入框内部占位符（Placeholder）、字段右侧轻量 Tooltip 图标或不可逆破坏性操作的二次确认弹窗中。
   - 避免双重页头、无意义 KPI 卡、冗长欢迎语。页面结构使用统一契约。

## 3. RMDL 主库改动规则

- 修改 `packages/ui`、`packages/tokens`、`registry/` 需要 UI Maintainer 职责和明确任务边界；即便候选代码实现完成，也不能未经授权标记 `approved`、创建正式发布或批准修改 Golden。
- 组件状态按 `proposed` → `candidate` → `approved` → `deprecated` → `retired`；**只有 approved + 真实发布版本**可强制业务消费。
- 从 A 项目提炼组件时，先抽离业务依赖，再增加 API 文档、不同状态示例、深浅色与响应式测试、可访问性和视觉基线，经所有者审批后才能发布给 B。
- 私有 GitHub Packages 还需构建到 dist、类型声明、包元数据、Owner/scope 认证；现有 `packages/ui` 是 v0.3 源码骨架，**尚不可直接当成已发布 DataTable**。

## 4. 多 Agent 任务协议

Root 给每个 Worker 写清：目标、输入文件、固定选型与共享包版本、允许写入路径、禁止写入路径、验收。Worker 只读检查必要文件，不能自行重选技术栈、改公共组件或更改 CI。Reviewer 不用主观感觉替代截图/测试证据。按工作范围互斥拆分并集中验收。

## 5. 真正交付之前

- 主库运行 `node scripts/check-repo.mjs`、已有 `node --test tests/rmdl-guard.test.mjs`；组件变更另加真实 build/typecheck/component tests/visual（未配置就报告 NOT RUN）。
- 业务库运行本项目实际存在的 `rmdl.mjs check`、install/typecheck/lint/test/build/visual；不能把静态守卫误认为完整视觉验证。
- 输出：选型/版本、复用组件、修改范围、真正执行的 PASS/FAIL/NOT RUN、风险、回滚、仍需所有者批准的点。不得伪称测试通过或已发布。

## 6. 推荐阅读（按任务选择）

- 新建/重构：`docs/01-选型与审批协议.md`、`docs/04-重构落地计划.md`
- 前端：`docs/02-前端视觉与页面契约.md`、`docs/11-视觉与工程验收.md`
- Agent 协作：`docs/03-多Agent与质量门禁.md`、`docs/06-跨Agent统一接入.md`
- 共享组件：`docs/07-组件注册晋升.md`、`docs/08-私有包发布与升级.md`
- GitHub 治理：`docs/09-GitHub私有仓库初始化.md`、`docs/12-决策与版本治理.md`
- 执行计划：`docs/13-分阶段实施路线图.md`、`docs/14-Agent任务模板.md`
