# RMDL Component Registry

这是公共设计组件状态登记表。请阅读 [组件晋升协议](../docs/07-组件注册晋升.md)。

`registry/components.json` 中的 `proposed` 或 `candidate` 不能被 Agent 当成正式可安装的组件；只有 `approved` 且有真实可安装版本、GitHub 审核/发布证据的条目才是强制复用标准。

当前模板只登记原有源码骨架与拟议的 DataTable，**不存在已发布的 DataTable**。
