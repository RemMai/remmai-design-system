# Contributing to RMDL

这是所有者维护的私有设计系统，不接受未经批准的技术选型和视觉偏离。

## 贡献路径

1. 提出需求或组件变更提案；先查 `registry/components.json` 是否已有相同职责。
2. 根 Agent 划定改动范围。触及 `RMDL.md`、`AGENTS.md`、`policy/`、`registry/`、`packages/ui/`、`packages/tokens/` 必须明示所有者审批点。
3. 在独立分支开发。UI 变更展示正常/空/加载/错误/禁用/响应式/深浅色；必要时附迁移说明与兼容策略。
4. 本地运行 `node scripts/check-repo.mjs`、`node --test tests/rmdl-guard.test.mjs`，再执行相关构建、类型检查和视觉测试（如已配置）。
5. 发起 PR，填写 `.github/pull_request_template.md`，由**真实仓库所有者**在 GitHub 上审阅，不能以聊天中的 Agent 自述替代。
6. 变更合并后根据语义版本规则发布；业务项目只通过固定版本和独立升级 PR 消费。

## 协作约束

- 不能靠修改校验脚本、工作流或截图基线来掩盖质量问题。
- 不允许在业务项目直接复制公共组件源代码形成分叉。
- 业务项目确实需要定制时，优先设计数据/插槽/变体 API；无法兼容时由所有者审批 ADR。
- 可回滚：每次公共发布保留 Tag、变更日志、升级路径。

详细流程：[07 组件注册晋升](docs/07-组件注册晋升.md)、[12 决策与版本治理](docs/12-决策与版本治理.md)。
