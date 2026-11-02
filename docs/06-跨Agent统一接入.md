# 06 — Codex、OpenCode、Claude Code 统一接入

## 一、架构目标

**一份设计标准（RMDL 主仓库） + 每个业务项目自己的选型锁（rmdl.project.json） + 同一组件包版本（@OWNER/rmdl-ui） + 代码/视觉门禁。**

重要区别：`AGENTS.md` 负责让 Agent 知道规则，**不是**强制访问控制。只有依赖锁、CI、分支策略和实际运行的测试才能形成可验证约束。Agent 可以误读/不读文档，因此必须以结果校验兜底。

## 二、三种 Agent 的加载适配

| Agent | 项目根文件 | 说明 |
|---|---|---|
| Codex | `AGENTS.md` | 使用项目说明；嵌套文件与规则作用范围依产品规则处理 |
| OpenCode | `AGENTS.md` | 可在 `opencode.json` 的 `instructions` 中追加按需文档；避免重复加载全套 45KB 规范 |
| Claude Code | `AGENTS.md` + `CLAUDE.md`（含 `@AGENTS.md`） | 兼容不同版本及已有 Claude 配置，避免只读到与主规范冲突的旧 `CLAUDE.md` |

**实际做法**：RMDL 主仓库根有 `AGENTS.md` 和薄 `CLAUDE.md`；业务项目根也应保留相同入口机制。不要在三个文件里分别复制全部 RMDL 细节，以免长期漂移。OpenCode 同时存在两类文件时通常优先 `AGENTS.md`；Claude Code 中已有 `CLAUDE.md` 可能阻止自动读取 AGENTS，所以使用显式导入最稳妥。

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

## 六、官方参考（在版本升级时再检查）

- Codex AGENTS.md: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex
- OpenCode Rules: https://opencode.ai/docs/rules/
- Claude Code Memory: https://code.claude.com/docs/en/memory

这些文档描述“如何读取”，不是防止模型违反规范的安全边界。运行中的 Agent 版本和配置应由你验证。
