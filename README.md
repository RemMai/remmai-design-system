# RemMai Design Language（RMDL）

> **v0.4 · 私有设计系统主仓库起步包** | 统一 Codex / OpenCode / Claude Code 的工程约束、UI 组件和页面体验。

**定位**：本仓库是 RMDL 唯一规范源、组件源与版本治理中心。业务项目 A/B/C 是 **消费方**，必须使用独立锁定的版本和选择结果；不得把业务实现直接提交到这里。RMDL 是工程标准，不是一个新的前端 UI 框架。

## 从哪里开始

> **完整顺序目录**：见 [00 文档目录与阅读顺序](docs/00-文档目录与阅读顺序.md)。`docs/01` 至 `docs/16` 全部存在，下方仅是按实际任务筛选的入口，不代表中间缺章。

1. **创建 GitHub 私有仓库并上传**：[09 GitHub 私有仓库初始化](docs/09-GitHub私有仓库初始化.md)
2. **让三个 Agent 读取相同规则**：[06 跨 Agent 统一接入](docs/06-跨Agent统一接入.md)
3. **初始化/重构时让你做选择**：[01 选型与审批协议](docs/01-选型与审批协议.md)、[12 决策与版本治理](docs/12-决策与版本治理.md)
4. **后端权限与 SSO 标准**：[15 后端权限与 Authentik 双模标准](docs/15-后端权限与Authentik双模标准.md)
5. **A 项目认可的表格如何让 B 项目复用**：[07 组件注册晋升](docs/07-组件注册晋升.md)、[08 私有包发布](docs/08-私有包发布与升级.md)
6. **把 RMDL 接入实际业务项目**：[10 业务项目接入](docs/10-业务项目接入.md)
7. **检查 UI 是否真正一致**：[11 视觉与工程验收](docs/11-视觉与工程验收.md)
8. **把任务交给 AI 落地**：[14 Agent 任务模板](docs/14-Agent任务模板.md)
9. **.NET 11、产品 Version 与 Git 标号**：[16 产品版本与构建标识](docs/16-产品版本与构建标识.md)。前端展示优先级：Footer > Menu 底部 > Header 右侧 > 更新日志菜单页。OpenCode 跨会话加载见 [06](docs/06-跨Agent统一接入.md)。

## 完整文档目录（01–16，按编号）

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
| 16 | [产品版本与构建标识](docs/16-产品版本与构建标识.md) | .NET 11、VERSION + Git commit、前后端构建绑定与展示 |

## 规范结构与优先级

- `RMDL.md`：设计语言和工程架构主标准（继承 v0.3，仍有效）。
- `AGENTS.md`：所有 Agent 的统一入口；`CLAUDE.md` 只导入入口，不复制另一套标准。
- `docs/01~05`：原 v0.3 选型、视觉、分工、重构、Codex 指令（原有内容保留）。
- `docs/06~14`：跨 Agent、公共组件、私有仓库、发布、验收与持续迭代。
- `registry/components.json`：组件目录，状态决定是否允许业务消费；`approved` ≠ 已发布，正式安装需包和版本同时可用。
- `packages/tokens`、`packages/ui`：v0.3 留存的基础源码骨架；**尚未达到正式可发布的完整组件包标准**。
- `scripts/rmdl.mjs`：继承 v0.3 版本契约并增补当前规则的业务选型/静态门禁 CLI。业务项目使用 `init/approve/check/audit/version`；**不要在规范主仓库执行 `check`**。
- `scripts/check-repo.mjs`：RMDL 主仓库自身校验；`.github/workflows/rmdl-repo.yml` 调用它。
- `templates/project/`：业务仓库接入示例，不会在主仓库作为 CI 执行。

### 不可绕过的决策

**owner = 你本人**。设计或技术栈决策不能由 Agent 推定为已批准。初始化/全局重构时先出选型表；现有业务项目按其 `rmdl.project.json` 锁定；公共组件必须经过提案 → 去业务化 → 展示与测试 → 你认可 → 版本发布的流程。

**前端统一原则**：工程化前端使用 React / TypeScript / Node.js + npm / HeroUI v3 / Tailwind v4 / Lucide / RMDL Tokens；Node.js 采用受支持的 LTS 并锁定版本，提交 `package-lock.json`，CI 使用 `npm ci`，不再使用 Bun。轻量 Tool 可经选型使用原生 HTML/CSS/JS 直接静态托管。两种模式共用 RMDL 视觉契约和 Tokens，不允许另建风格体系；工程化构建产物也可部署 OSS。既有项目迁移见 [ADR-0001](docs/decisions/ADR-0001-nodejs-npm.md)。

## 当前能力边界（不要让 AI 虚报完成）

| 模块 | 当前状态 | 说明 |
|---|---|---|
| v0.3 文档、业务项目 CLI、最小静态检查 | 可使用 | 根据业务项目真实文件运行；需要额外补 typecheck、lint、Visual |
| 跨 Agent 统一入口和流程文档 | 已给出 | 项目必须实际引用这些文件才能生效 |
| RemMai.Rmdl.Auth (.NET 双模授权库) | 既有目标 net10.0/net8.0 | 应用标准已更新为 .NET 11；该包在 net11.0 Host 下的兼容验收仍需执行 |
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

### 1. 启动标准管理菜单

安装 Node.js LTS 和 Git，并确保 Git 能读取本仓库（私有库先配置自己的 Git 凭据）。Windows 可将 **[`rmdl.cmd`](rmdl.cmd) 单独复制到目标文件夹后双击**。启动器先寻找旁边或 `vendor/rmdl` 内的脚本；缺少时用 Git 下载工具到临时目录，再打开菜单。也可以保留完整标准仓库，在任意目录运行：

```powershell
# 将路径替换为本机标准仓库位置；项目目录会在菜单内询问
node 'D:\Tools\remmai-design-system\scripts\bootstrap.mjs'
```

菜单提供 **初始化标准 / 更新标准 / 检查项目 / 更新并检查 / 退出**。选择操作后输入项目目录，Agent 规则可选 **OpenCode（默认）/ 跳过**，再选择标准分支/Tag/commit 和可选代理。默认值直接回车。独立启动器默认选择它所在的目录；已有业务仓库选择更新。初始化或更新成功后，菜单会询问是否立即检查，无需再手敲命令。

**初始化标准**要求目标为空目录（允许其中只有当前启动的 `rmdl.cmd`），或父目录已存在的新目录；会初始化业务 Git 仓库、把标准固定为 `vendor/rmdl` submodule，并写入来源记录 `rmdl.bootstrap.json`。当前启动器会保留并纳入暂存。选择 OpenCode 时安装根 `AGENTS.md` 和 `opencode.json`；选择跳过则不安装任何 Agent 入口。当前自动接入仅支持 OpenCode，其他 Agent 后续增加；既有兼容模板保留但不自动复制。

首次下载工具会复用 Git 凭据与代理。Windows 没有显式 Git/环境代理时，启动器尝试读取已启用的系统 HTTP 代理；也可设置 `RMDL_PROXY` 或传入 `--proxy`。不会写入全局 Git 设置。当前功能分支尚未合并 main，独立启动器默认从 `chore/dotnet11-product-version-standards` 获取工具；可用 `RMDL_BOOTSTRAP_REF` 指定其他包含脚本的分支/Tag。

成功后，在业务目录打开 OpenCode，输入：**“请按 RMDL 标准引导我完成新项目选型。”** 接入脚本只准备规范，不自动选择框架/数据库、不填写审批、不创建业务代码。也可手动运行 `node vendor/rmdl/scripts/rmdl.mjs init new --root .` 开始选型。

初始化生成的文件已暂存但未提交；核对后自行提交业务仓库。未配置技术选型与工程前，不应将业务门禁预期失败当成脚本安装失败。

> **克隆已包含子模块的业务仓库**：如果是他人或在全新机器拉取业务仓库，使用：  
> `git clone --recurse-submodules <业务仓库URL>`  
> 或者在常规 clone 后执行：`git submodule update --init --recursive`

---

### 2. 更新标准

再次打开同一脚本，选择 **更新标准** 并指向已有业务仓库。默认复用上次的引用：分支会取最新远端 commit；Tag/commit 保持固定，需要升级时显式输入新引用。无论选择哪种引用，业务仓库最终记录的都是精确 commit。`HEAD` 表示远端默认分支。

更新会保留业务 `rmdl.project.json`、VERSION 与 CHANGELOG，检查标准子模块的本地修改，合并 OpenCode 的 instructions 并保留其他设置。自定义修改过的 AGENTS.md 或另一份 JSONC 配置需要人工合并；可选择「跳过」仅更新标准，现有 Agent 文件不会被删除。更新只生成可审查的工作区变更，不暂存、不提交、不推送。

完成后审查 `git diff`，运行 `node vendor/rmdl/scripts/rmdl.mjs check --root .` 和实际工程测试，按新标准迁移必要配置后再提交。详细参数、失败处理与回滚见 [10 业务项目接入](docs/10-业务项目接入.md#七标准管理脚本)。

### 3. 直接检查项目

菜单选择 **3. 检查项目**，或初始化/更新后按提示选择检查范围：

1. **仅标准门禁**：运行 `vendor/rmdl/scripts/rmdl.mjs check`，快速验证选型锁、依赖、锁文件、版本绑定与 .NET 目标框架。
2. **标准 + 工程检查**：在标准门禁后，按项目实际存在的命令依次执行 `npm run typecheck`、`lint`、`test`、`build`（根目录与 `apps/web` 有 `package.json` 时），以及 `dotnet build -c Release`（找到 `.sln`/`.slnx` 且本机有 dotnet 时）。

结果逐项标记 **PASS / FAIL / NOT RUN** 并汇总。未定义的脚本、缺失的 dotnet 或未配置的视觉回归显示 NOT RUN，不会被当作通过；存在 FAIL 时命令返回非零。检查只读，不修改项目文件。视觉回归与人工页面审查仍需按项目配置单独执行。

## 仓库使用纪律

所有规范、组件和 Token 的公共变更只能通过 **RMDL 主仓库** 完成；业务仓库不能以覆盖 CSS 的方式“修复”公共组件。设计变更需要 issue/ADR、组件示例、测试、版本号及你的批准；消费者通过固定版本和 PR 升级。Agent 的输出只算提案，永远不是所有者批准证明。

仓库的私有属性不等于访问权限完全安全。务必控制 PAT、CI 密钥、Actions 读取权限；禁止把 `.npmrc` token、个人密钥、证书和客户/生产数据提交到 Git。
