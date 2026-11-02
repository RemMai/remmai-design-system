# 09 — GitHub 私有仓库初始化与首次上传（Windows / Linux）

## 一、创建私有仓库

在 GitHub 登录，点击右上角 `+` → `New repository`，建议：

| 项目 | 推荐填写 |
|---|---|
| Repository name | `remmai-design-system` |
| Description | `RMDL - private design system and multi-agent engineering standards` |
| Visibility | **Private** |
| README / .gitignore / License | **不要勾选初始化**（本包已经包含 README；保持空仓库方便首次推送） |

创建后，复制 GitHub 给出的 **HTTPS 仓库地址**。下方用 `<OWNER>` 占位，替换为你的真实 GitHub 用户名/组织名。GitHub 上尚未创建仓库之前，以下 git push 不能成功。

## 二、解压并验证本地内容

将 `RMDL-v0.4-GitHub.zip` 解压，进入包含 `README.md`、`RMDL.md`、`AGENTS.md` 的根目录；Windows PowerShell / Linux Bash 均可执行：

```bash
node scripts/check-repo.mjs
node --test tests/rmdl-guard.test.mjs
```

这是规范主仓库，**不要**运行 `node scripts/rmdl.mjs check`；它要求业务项目已建立 `rmdl.project.json` 和应用源代码。

## 三、通过 Git 推送（已有 Git）

```bash
git init -b main
git add .
git commit -m "chore: initialize RMDL private design system"
git remote add origin https://github.com/<OWNER>/remmai-design-system.git
git push -u origin main
```

如果你已经初始化了仓库，跳过 `git init`；如果已经设置 `origin`，先用 `git remote -v` 查看，必要时 `git remote set-url origin <URL>`。HTTPS 认证使用 Git Credential Manager / GitHub CLI / 适用令牌，**不能使用 GitHub 账户密码直接作为 Git 认证**。

## 四、也可以用 GitHub CLI

本地安装并认证 `gh` 后，可在该目录执行：

```bash
gh auth login
git init -b main
git add .
git commit -m "chore: initialize RMDL"
gh repo create remmai-design-system --private --source=. --remote=origin --push
```

**两种方式二选一**；如果已经通过网站创建了同名私有仓库，使用第三节的 `git remote add` 流程，不要重复 `gh repo create`。

## 五、上传完成后的检查

在 GitHub 仓库中确认：

- 仓库标题附近显示 Private。
- 根目录有 `AGENTS.md`、`CLAUDE.md`、`RMDL.md`、`registry/`、`docs/`、`packages/`。
- `.github/workflows/rmdl-repo.yml` 在 Actions 中可见，并且构建通过。
- `README.md` 的链接能打开，`registry/components.json` 仍只有非正式候选项（不能误以为 DataTable 已发布）。

## 六、分支保护与计划限制

建议开启主分支强制 PR、至少一次 Review、Required Status Check、限制 force-push/删除，并设置真实所有者为 CODEOWNERS。**但是 GitHub Free 的私有仓库不能假定具有可执行的 branch protection / rulesets**；GitHub 官方说明：私人仓库的保护能力主要在 GitHub Pro / Team / Enterprise 套餐中。你需要根据自己 GitHub 账户实际权限检查可用选项，不能仅因为 YAML 中写了检查就声称“禁止合并”。

操作路径（有权限时）：`Settings` → `Rules` → `Rulesets` → `New branch ruleset`，目标 `main`，启用 PR、审批和检查。选择真实 CI job 名称作为 Required Status Check，比如 `rmdl-repository-check`，先让 Action 跑过一次再选择。正式 CODEOWNERS 请把 `docs/CODEOWNERS.example` 里的占位用户名改成自己的 GitHub 名称后，放到 `.github/CODEOWNERS`，包括 `.github/CODEOWNERS` 自身。

**免费计划务实替代**：仍全部走 feature 分支和 PR；你人工看 diff 和 CI 结果后才合并。此流程是一种纪律，**不具备平台强制保障**，不能声称 Agent 已被技术性禁止绕过。需要硬性防护时升级 GitHub 计划，或采用不把 Agent 授予 main 写权限的账号/令牌隔离。

## 七、重要安全检查

- 不提交 PAT、SSH 私钥、生产数据库连接串、证书或真实密钥。
- 只给 Agent 必要的仓库访问权限；不提供能关闭 branch rule 的管理员凭据。
- 私有仓库的 Actions、克隆、submodule 与 Packages 都要单独考虑认证和访问权。
- 不是每个 CI Runner 都能访问 private submodule；需显式授权最小权限凭据。
- 使用 `.gitignore` 排除 `node_modules/`、`dist/`、`.env*`、屏幕录制可能包含隐私的内容（有需要的 `.env.example` 例外单独允许）。

GitHub 参考：
- 仓库快速开始：https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories
- rulesets：https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
- GitHub CLI：https://cli.github.com/manual/gh_repo_create
