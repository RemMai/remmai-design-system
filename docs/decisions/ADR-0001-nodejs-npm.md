# ADR-0001 — JavaScript 工具链统一 Node.js + npm

- 状态：所有者已明确要求本次标准修改；尚未发布新规范版本。
- 所有者决定记录：2026-11-11 本次会话原文：「因为发现bun 好多的 npm包不兼容，然后现在换成了nodejs，你帮我改一下标准，现在就是不用bun，统一换成nodejs。」
- 日期：2026-11-11

## 既有标准与原因

原标准固定 Bun、`bun.lock`、frozen install，业务检查器还会拒绝 `package-lock.json`。所有者反馈 npm 包兼容问题并明确要求统一 Node.js；本次没有具体业务样本，不声称已复现某个依赖的不兼容。

## 决策与比较

- 采用 Node.js 作为 JavaScript 运行时，npm 作为配套包管理器；相比继续维护 Bun 例外路径，统一工具链能避免运行时和安装行为差异。
- 不引入 pnpm/Yarn 作为第二套包管理方案。Node.js 使用受支持且经依赖兼容验证的 LTS，具体 Node.js/npm 版本由业务项目锁定，不在本次标准修订中猜测最新版本。
- 配置固定 `runtime: "node"` 与 `packageManager: "npm"`；依赖使用 `package-lock.json`，CI 使用 `npm ci`，脚本使用 `npm run`。
- 保持 React、TypeScript strict、HeroUI v3、Tailwind v4、Lucide、RMDL UI/Tokens 及原有审批与质量门禁不变。`static-html` 仍豁免构建工具链。
- 不调整组件发布版本、Registry 审批状态或历史 Tag；v0.3 校验器的版本号及共享包版本兼容限制仍保留。本次标准工作区变更会拒绝旧工具链配置，消费者必须审阅差异后升级，不得覆盖已发布快照。

## 业务项目迁移

1. 建立独立迁移分支，记录当前 RMDL commit、选型配置、依赖锁文件与基线测试结果。
2. 核对 Bun 专有 API、测试运行器、脚本、Docker 和 CI；改用 Node.js 兼容实现。删除或替换 `workspace:*` 依赖声明，npm workspaces 使用匹配本地包的精确版本号。
3. 在业务项目的迁移审批中记录标准更新及影响，将 `fixed.runtime` 设为 `node`、`fixed.packageManager` 设为 `npm`；保留真实历史审批，不伪造 `approvedBy` 或 `approvedAt`。
4. 锁定兼容的 Node.js LTS/npm，在真实 npm 工作区执行 `npm install` 生成并提交 `package-lock.json`，检查依赖解析差异，再运行 `npm ci` 验证可重现安装。新旧包管理器不可共用未经清理的安装目录。
5. 完成依赖和工程验证后，在迁移分支移除旧 `bun.lock`/`bun.lockb` 及 Bun 配置；最终工作区不得混用锁文件。根 npm workspace 与独立 `apps/web` 只在各自正确边界保留锁文件。
6. 执行真实业务静态门禁、typecheck、lint、test、build、相关 visual；全部通过并经审查后才升级业务项目的 RMDL commit 指针及部署。

## 验证与回滚

- 主库验证：`node scripts/check-repo.mjs`、`node --test tests/rmdl-guard.test.mjs`。测试覆盖新选型、npm 锁文件位置、旧选型/混用锁文件拒绝、npm workspaces 协议和静态页豁免；实际执行结果随本次交付报告，不在 ADR 中预填 PASS。
- 本次不迁移外部业务项目，也不声称其 npm 安装或构建已经验证。
- 回滚以审阅过的迁移提交为单位，恢复此前的 RMDL commit、选型、依赖清单、锁文件与 CI/Docker 配置，并使用原工具链重新安装和验证；不覆盖或丢弃迁移之外的工作。
