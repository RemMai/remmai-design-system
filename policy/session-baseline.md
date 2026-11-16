# 每个会话的 RMDL 执行基线

- 先识别主规范仓库或业务仓库。主库使用 `node scripts/check-repo.mjs` 和 `node --test tests/rmdl-guard.test.mjs`；业务使用锁定的 `vendor/rmdl/scripts/rmdl.mjs check --root .` 加真实工程检查。
- 业务编码前读取根 `AGENTS.md`、已锁定 `rmdl.project.json`、`VERSION`、`CHANGELOG.md` 和 Git 状态。初始化/整体重构遵守选型审批；日常开发按已有选型继续。新 session 和上下文恢复都重新确认文件，不依赖聊天记忆。
- 工程化前端固定 React、TypeScript strict、Node.js LTS + npm、HeroUI v3、Tailwind v4、Lucide、RMDL Tokens 和同版本已批准发布的共享组件。轻量 static-html 依已锁定选型。
- .NET 应用使用 .NET 11 / net11.0，根 global.json 锁定精确正式 11.x SDK；默认 FreeSql + CodeFirst。认证沿用 RMDL Auth 契约。
- 前后端绑定根 VERSION 的产品 MAJOR.MINOR.PATCH；构建从真实 Git HEAD 生成完整 gitCommit。发布拒绝脏工作区；运行时读取制品元数据。不得将规范版本或框架版本当产品版本。
- 前端显示 Version x.y.z：Footer > 左侧 Menu 底部 > Header 右侧 > 独立更新日志菜单页。后端提供 version + gitCommit。细节见 docs/16-产品版本与构建标识.md（业务仓库在 vendor/rmdl 下）。
- UI 不添加功能宣讲卡；Admin 固定 Header/Menu、内容独立滚动、用户区沉底。版本标签紧凑，不能覆盖账号/退出操作。
- 不自行改审批记录、规范、Tokens、共享组件、门禁或 Golden 来通过任务。子任务显式传递同样约束与允许修改范围。
- 开工说明适用选型、版本来源、修改范围和验证命令；交付报告实际 PASS/FAIL/NOT RUN。静态检查不证明 UI 位置或真实制品已绑定版本，必须用浏览器/运行制品验证。
