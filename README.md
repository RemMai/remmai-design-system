# RemMai Design Language（RMDL）

> **v0.4 · 私有设计系统主仓库起步包** | 统一 Codex / OpenCode / Claude Code 的工程约束、UI 组件和页面体验。

**定位**：本仓库是 RMDL 唯一规范源、组件源与版本治理中心。业务项目 A/B/C 是 **消费方**，必须使用独立锁定的版本和选择结果；不得把业务实现直接提交到这里。RMDL 是工程标准，不是一个新的前端 UI 框架。

## 从哪里开始

> **完整顺序目录**：见 [00 文档目录与阅读顺序](docs/00-文档目录与阅读顺序.md)。`docs/01` 至 `docs/15` 全部存在，下方仅是按实际任务筛选的入口，不代表中间缺章。

1. **创建 GitHub 私有仓库并上传**：[09 GitHub 私有仓库初始化](docs/09-GitHub私有仓库初始化.md)
2. **让三个 Agent 读取相同规则**：[06 跨 Agent 统一接入](docs/06-跨Agent统一接入.md)
3. **初始化/重构时让你做选择**：[01 选型与审批协议](docs/01-选型与审批协议.md)、[12 决策与版本治理](docs/12-决策与版本治理.md)
4. **后端权限与 SSO 标准**：[15 后端权限与 Authentik 双模标准](docs/15-后端权限与Authentik双模标准.md)
5. **A 项目认可的表格如何让 B 项目复用**：[07 组件注册晋升](docs/07-组件注册晋升.md)、[08 私有包发布](docs/08-私有包发布与升级.md)
6. **把 RMDL 接入实际业务项目**：[10 业务项目接入](docs/10-业务项目接入.md)
7. **检查 UI 是否真正一致**：[11 视觉与工程验收](docs/11-视觉与工程验收.md)
8. **把任务交给 AI 落地**：[14 Agent 任务模板](docs/14-Agent任务模板.md)

## 完整文档目录（01–15，按编号）

| 编号 | 文档 | 重点 |
|---|---|---|
| 01 | [选型与审批协议](docs/01-选型与审批协议.md) | 新建/重构前向所有者呈现选型并锁定 |
| 02 | [前端视觉与页面契约](docs/02-前端视觉与页面契约.md) | 统一页面布局、视觉层级、组件使用与文案密度 |
| 03 | [多Agent与质量门禁](docs/03-多Agent与质量门禁.md) | 多 Agent 职责划分、门禁与验收责任 |
| 04 | [重构落地计划](docs/04-重构落地计划.md) | 旧项目审计、分阶段重构和迁移 |
| 05 | [可直接交给Codex的执行说明](docs/05-可直接交给Codex的执行说明.md) | 原有 Codex 执行指令（仍保留，通用任务可参考 14） |
| 06 | [跨Agent统一接入](docs/06-跨Agent统一接入.md) | Codex / OpenCode / Claude Code 共同读取 RMDL 的接入方式 |
| 07 | [组件注册晋升](docs/07-组件注册晋升.md) | 从业务项目提名、抽取、审批并登记公共组件 |
| 08 | [私有包发布与升级](docs/08-私有包发布与升级.md) | 私有组件包构建、版本发布和跨项目升级 |
| 09 | [GitHub私有仓库初始化](docs/09-GitHub私有仓库初始化.md) | 创建 GitHub 私有仓库、首次上传和访问管理 |
| 10 | [业务项目接入](docs/10-业务项目接入.md) | 业务仓库固定 RMDL 版本、引用规范和组件 |
| 11 | [视觉与工程验收](docs/11-视觉与工程验收.md) | UI 视觉回归、静态检查、工程质量与合规验收 |
| 12 | [决策与版本治理](docs/12-决策与版本治理.md) | ADR 决策、例外审批、版本和所有权治理 |
| 13 | [分阶段实施路线图](docs/13-分阶段实施路线图.md) | 从文档到可用组件库的分阶段实施路线图 |
| 14 | [Agent任务模板](docs/14-Agent任务模板.md) | 给不同 Agent 直接使用的任务模板 |
| 15 | [后端权限与Authentik双模标准](docs/15-后端权限与Authentik双模标准.md) | 自管RBAC与Authentik OAuth双模权限体系与对接契约 |

## 规范结构与优先级

- `RMDL.md`：设计语言和工程架构主标准（继承 v0.3，仍有效）。
- `AGENTS.md`：所有 Agent 的统一入口；`CLAUDE.md` 只导入入口，不复制另一套标准。
- `docs/01~05`：原 v0.3 选型、视觉、分工、重构、Codex 指令（原有内容保留）。
- `docs/06~14`：跨 Agent、公共组件、私有仓库、发布、验收与持续迭代。
- `registry/components.json`：组件目录，状态决定是否允许业务消费；`approved` ≠ 已发布，正式安装需包和版本同时可用。
- `packages/tokens`、`packages/ui`：v0.3 留存的基础源码骨架；**尚未达到正式可发布的完整组件包标准**。
- `scripts/rmdl.mjs`：v0.3 的业务项目选型/静态门禁 CLI。业务项目使用 `init/approve/check/audit`；**不要在规范主仓库执行 `check`**。
- `scripts/check-repo.mjs`：RMDL 主仓库自身校验；`.github/workflows/rmdl-repo.yml` 调用它。
- `templates/project/`：业务仓库接入示例，不会在主仓库作为 CI 执行。

### 不可绕过的决策

**owner = 你本人**。设计或技术栈决策不能由 Agent 推定为已批准。初始化/全局重构时先出选型表；现有业务项目按其 `rmdl.project.json` 锁定；公共组件必须经过提案 → 去业务化 → 展示与测试 → 你认可 → 版本发布的流程。

**前端统一原则**：React / TypeScript / Bun / HeroUI v3 / Tailwind v4 / Lucide / RMDL Tokens；所有后台的基础布局和组件来自 RMDL 包，不允许每个项目自己建第二套设计系统。具体选择以主规范的强制条款和例外审批为准。

## 当前能力边界（不要让 AI 虚报完成）

| 模块 | 当前状态 | 说明 |
|---|---|---|
| v0.3 文档、业务项目 CLI、最小静态检查 | 可使用 | 根据业务项目真实文件运行；需要额外补 typecheck、lint、Visual |
| 跨 Agent 统一入口和流程文档 | 已给出 | 项目必须实际引用这些文件才能生效 |
| RemMai.Rmdl.Auth (.NET 双模授权库) | 已实现并测试 | 支持 .NET 10/8、FreeSql、Authentik OIDC、首登自举与权限过滤 |
| Tokens、AppShell 相关组件源码 | 原型 | 尚未形成可跨仓库发布的构建产物 |
| DataTable、Registry 的 approved 条目 | 尚无 | 不得声称 DataTable 已实现或发布 |
| GitHub Packages 私有发布流程 | 文档/待实施 | 必须完成构建、测试、认证与 release workflow |
| Playwright 视觉回归及黄金截图 | 待实施 | 由业务/组件项目配置并经你审定基线 |
| GitHub 私有分支保护 | 需手动开启 | 取决于 GitHub 账户方案与仓库配置 |

## 首次上传

将本压缩包解压后，以 **包含本 README.md 的目录** 作为仓库根目录。GitHub 新建私有仓库（建议名称 `remmai-design-system`），不要在网页创建另一份 README，然后执行：

```bash
git init -b main
git add .
git commit -m "chore: bootstrap RMDL design system"
git remote add origin https://github.com/<YOUR_GITHUB_OWNER>/remmai-design-system.git
git push -u origin main
```

先运行 `node scripts/check-repo.mjs` 和 `node --test tests/rmdl-guard.test.mjs` 验证结构；**不要在规范主仓库运行 `node scripts/rmdl.mjs check`**，该命令检查的是业务项目。

具体说明、密钥处理、GitHub Free 私有仓库保护限制、克隆方式：[09](docs/09-GitHub私有仓库初始化.md)。

## 业务项目如何引入与更新本标准

业务仓库（如你的各业务系统）通过 **Git Submodule** 引入并锁定本规范，切勿直接拷贝本仓库源码。

### 1. 业务项目初次引入标准

在你的业务项目根目录下执行：

```bash
# 1. 将规范库作为子模块添加到 vendor/rmdl
git submodule add https://github.com/RemMai/remmai-design-system.git vendor/rmdl

# 2. 复制 Agent 规范入口模板到业务项目根
cp vendor/rmdl/templates/project/AGENTS.md ./AGENTS.md
cp vendor/rmdl/templates/project/CLAUDE.md ./CLAUDE.md

# 3. 初始化并锁定该业务项目的技术选型（按提示回答或直接生成）
node vendor/rmdl/scripts/rmdl.mjs init new --root .
node vendor/rmdl/scripts/rmdl.mjs approve --root .

# 4. 提交引入基线
git add .gitmodules vendor/rmdl AGENTS.md CLAUDE.md rmdl.project.json
git commit -m "chore: integrate RMDL design standards submodule"
```

> **克隆已包含子模块的业务仓库**：如果是他人或在全新机器拉取业务仓库，使用：  
> `git clone --recurse-submodules <业务仓库URL>`  
> 或者在常规 clone 后执行：`git submodule update --init --recursive`

---

### 2. 业务项目后续更新标准（Pull & Re-check）

当 RMDL 主仓库发布了新规范、新文档（如新增权限标准）或修复了门禁脚本后，在业务项目根目录下按以下步骤更新：

```bash
# 方式 A：进入 submodule 目录精准拉取（最稳妥，支持指定分支或 Release Tag）
cd vendor/rmdl
git pull origin main
# 若需锁定到指定发布版本：git checkout <TAG_NAME>
cd ../..

# 方式 B：根目录单行更新
git submodule update --remote --merge vendor/rmdl

# 检查：拉取更新后，立即运行门禁验证业务项目是否依然合规
bun vendor/rmdl/scripts/rmdl.mjs check --root .

# 提交：在业务仓中记录本次规范升级的 Commit 指针
git add vendor/rmdl
git commit -m "chore(rmdl): upgrade RMDL design standards to latest"
```

## 仓库使用纪律

所有规范、组件和 Token 的公共变更只能通过 **RMDL 主仓库** 完成；业务仓库不能以覆盖 CSS 的方式“修复”公共组件。设计变更需要 issue/ADR、组件示例、测试、版本号及你的批准；消费者通过固定版本和 PR 升级。Agent 的输出只算提案，永远不是所有者批准证明。

仓库的私有属性不等于访问权限完全安全。务必控制 PAT、CI 密钥、Actions 读取权限；禁止把 `.npmrc` token、个人密钥、证书和客户/生产数据提交到 Git。
