# 06 — Codex、OpenCode、Claude Code 统一接入

## 一、架构目标

**一份设计标准（RMDL 主仓库） + 每个业务项目自己的选型锁（rmdl.project.json） + 同一组件包版本（@OWNER/rmdl-ui） + 代码/视觉门禁。**

重要区别：`AGENTS.md` 负责让 Agent 知道规则，**不是**强制访问控制。只有依赖锁、CI、分支策略和实际运行的测试才能形成可验证约束。Agent 可以误读/不读文档，因此必须以结果校验兜底。

## 二、三种 Agent 的加载适配

| Agent | 项目根文件 | 说明 |
|---|---|---|
| Codex | `AGENTS.md` | 使用项目说明；嵌套文件与规则作用范围依产品规则处理 |
| OpenCode V2 | `AGENTS.md` + `opencode.json` | `instructions` 显式加载短基线；只识别 AGENTS.md，不使用 CLAUDE.md 兜底 |
| Claude Code | `AGENTS.md` + `CLAUDE.md`（含 `@AGENTS.md`） | 兼容不同版本及已有 Claude 配置，避免只读到与主规范冲突的旧 `CLAUDE.md` |

**实际做法**：RMDL 主仓库根有 `AGENTS.md`、薄 `CLAUDE.md` 和 `opencode.json`；业务项目根复制对应模板。OpenCode V2 使用 AGENTS.md；CLAUDE.md 为 Claude Code 导入入口。不要在三处分别复制完整标准。

用户全局配置只能作为提醒，**不能保证每一个子 Agent 自动继承**；根 Agent 派发任务时必须显式传入适用规范、锁定配置、禁止触碰的目录与验收条件。

## 三、业务仓库如何获得主规范

建议起步采用 **Git submodule 固定版本**（便于审计，多个仓库都适用），路径 `vendor/rmdl`：

```bash
git submodule add https://github.com/<OWNER>/remmai-design-system.git vendor/rmdl
cd vendor/rmdl && git checkout <APPROVED_RMDL_TAG_OR_COMMIT>
cd ../..
git add .gitmodules vendor/rmdl
git commit -m "chore: pin RMDL standards"
```

Git submodule 不会自动合并更新；每次升级要审查，再在业务仓库提交新指针。**私有库要求参与者和 CI 都有读取权限**。不要让业务 Agent 自动执行 submodule update --remote。

如果不用 submodule，也可以用锁定版本同步规则文件的脚本；但同步必须可追溯、可比较版本、可防止本地私自篡改。仅使用指向 main 分支的动态 URL 不构成可复现的规范锁。

**规则入口一定要在业务项目根目录真实存在**（参见 `templates/project/AGENTS.md`），因为不能假设编码 Agent 会自动搜索 vendor 目录来读取规范。

## 四、任务开始前统一准入

1. 读取根 `AGENTS.md`，确认 RMDL 版本来源。
2. 读取 `rmdl.project.json`，确认 `governance.state === "locked"`。
3. 若是初始化/整体重构：先给出后端语言、ORM、数据库、部署及前端项目形态的可选项，等待所有者选择；不得先创建业务代码。
4. UI 需求先查当前已安装的组件包的导出项与 `registry/components.json`，已批准且已发布的组件必须复用。
5. 写明工作范围：允许修改、禁止修改、检查与交付物；子 Agent 不能暗改公共包、tokens、工具链。

## 五、禁止绕过规则

- 不得自行引入另一套 UI 基础库。
- 不得在业务项目通过深层 CSS 选择器、复制公共组件内部源码、`!important` 等手段“改回自己喜欢的风格”。
- 不得在未批准情况下更新视觉黄金样本。
- 不得绕过 `rmdl.project.json` 锁定配置，私自改变 ORM、包管理器、框架。
- UI 包升级只能提出变更 PR，消费者需明确升级，不准漂移到 latest。

## 六、OpenCode 新 session 持续遵守

新会话不应依赖昨天聊天的记忆。把规则与项目状态提交到仓库：

- 根 `AGENTS.md`：任务准入、规则索引、禁止改动范围、真实验证命令。
- 根 `opencode.json`：主库加载 `policy/session-baseline.md`；业务库加载 `vendor/rmdl/policy/session-baseline.md`。模板已有此配置。已有配置时合并 instructions，保留其他设置。
- 根 `rmdl.project.json`、VERSION、CHANGELOG.md：保存已决定的选型和产品版本。长任务把剩余事项/已执行验证写入项目任务记录，新会话结合 Git diff 继续，不将任务记录当作新审批。
- CI：固定标准 commit，执行静态检查及真实 build/test/visual，配置必需检查与审查者。提示词用于引导，CI 用于拒绝违规结果。

在业务项目目录内打开会话，确认 submodule 已初始化且基线文件存在。OpenCode 官方文档说明：缺失 instructions 文件会被跳过；`OPENCODE_DISABLE_PROJECT_CONFIG=1` 会禁用项目发现，所以必须检查环境配置。可让首轮简短报告读取的标准路径、产品版本、允许修改范围和验证命令，便于发现漏读。

全局 `~/.config/opencode/AGENTS.md` 会与项目规则共同加载，OpenCode **不会自动消解冲突**。全局文件应只放简短通用偏好；角色扮演、其他领域的长流程、要求忽略工程规则的文字应移到明确调用的独立技能。仅增加更多“必须遵守”不能解决互相冲突的指令。修改全局文件前先备份并明确保留需要的偏好。

项目配置保存后自动重载，需要时使用 `/reload`；不要为了应用配置反复重启服务。已加载的嵌套 AGENTS.md 修改不会自动重新发现，需要立即应用时开启新会话。根/上层规则与显式 instructions 支持更新；本仓库优先将关键短基线放在这条加载路径。

## 七、官方参考（在版本升级时再检查）

- Codex AGENTS.md: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex
- OpenCode V2 Instructions: https://opencode.ai/docs/instructions
- OpenCode V2 Config: https://opencode.ai/docs/config
- Claude Code Memory: https://code.claude.com/docs/en/memory

这些文档描述“如何读取”，不是防止模型违反规范的安全边界。运行中的 Agent 版本和配置应由你验证。
