# 03 — 多 Agent 委派、检查与失败处理

## 1. Root / Worker 责任

**Root Agent**：只读确认锁定选型、建立变更范围、选定页面模式、拆任务与文件所有权、统一验收。不能指望子 Agent 自动读到主会话约束，所以分派时必须给每个 Worker 传入：`AGENTS.md`、`rmdl.project.json`、相关 UI 契约、允许修改路径、DoD。

**Business Worker**：只能修改业务模块与相应页面；只消费 `@remmai/rmdl-ui`；想新增公共组件必须向 Root 报告，不允许自己复制一份公共组件。

**UI Maintainer Worker**：只在明确获得所有者批准的 UI 版本迭代中修改 `packages/ui` 和 `packages/tokens`，必须包含组件 demo / Light Dark / 状态测试 / 视觉基线升级说明。

**Reviewer Worker**：只读核对依赖、违反禁令、UI 一致性、无意义文案；提供证据而不是主观“看起来不错”。

## 2. Agent 工作范围必须写明

```text
选型：引用 rmdl.project.json，禁止重选
交付：新增 XX 列表页；使用 RMDL list 模板
准入读取：src/features/xx, packages/ui exports, docs/02
允许写入：apps/web/src/features/xx/**
禁止写入：packages/ui/**, packages/tokens/**, policy/**, rmdl.project.json
验收：RMDL guard + typecheck + lint + 用例 + 1440/390 截图
发现跨范围需求：停止，反馈 Root Agent；不得顺手改全站
```

## 3. CI 纪律

- 必须设置 `rmdl-check` 为受保护分支的**Required Status Check**。
- `AGENTS.md`、`RMDL.md`、`rmdl.project.json`、`policy/`、`packages/ui`、`packages/tokens` 的修改必须由项目所有者或指定 UI/架构审查者审阅（示例见 `docs/CODEOWNERS.example`）。
- 执行 `node scripts/rmdl.mjs check`；应用实际脚手架配置完成后，追加 Bun frozen install、Typecheck、Lint、Test、Build 与 Playwright Visual Regression。
- 无法运行的检查报告为 NOT RUN，不能记为 PASS。
- 严禁 `|| true`、跳过失败用例、删除断言、无审查更新截图基线、禁用 lint 规则来使 CI 变绿。

## 4. Agent 违反规范时如何处理

立即停止冲突任务，列出：具体规则、当前代码/依赖、触发原因、回滚范围、是否需要 ADR、额外测试。先修违规再继续任务；连续违规的 Agent 应缩小写权限或改为只读分析。

## 5. 防止误以为强制的边界

任何 repo 脚本都可能被有写权限的人篡改。保护不能只靠 AI 提示词或同仓脚本，应将 CI 工作流与代码所有者规则设为受保护、由仓库维护者审核。`rmdl.project.json` 的批准字段只是工作流证据，不是密码学意义的授权验证。
