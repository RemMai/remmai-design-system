# RMDL — RemMai Design Language

> 跨项目产品设计语言 · 工程架构规范 · AI 协作开发基线  
> **规范仓库版本**：v0.4.0（核心技术条款沿用 v0.3；新增跨 Agent、组件 Registry、私有发布与 GitHub 治理） · **修订日期**：2026-11-02
> **工具兼容状态**：`scripts/rmdl.mjs` 仍是 v0.3 校验器，包名 `@remmai` / UI 版本 `0.3.0` 尚未参数化；发布跨私有仓库组件前必须完成适配  
> **适用范围**：Web、管理后台、用户门户、移动 App、桌面程序、CLI、服务端、后台任务及数据平台

---

## 0.A v0.4 主仓库与业务仓库区分（优先遵循）

- 本仓库是 RMDL 规范与公共组件**主仓库**，无需也不应伪造业务项目 `rmdl.project.json`。主仓库验证使用 `node scripts/check-repo.mjs`；下文 `scripts/rmdl.mjs check` 的交付要求指**业务项目**。
- 各业务项目单独选择并锁定技术栈、依赖固定版本的 RMDL UI/Tokens，并以 Git commit/Tag 固定规范版本。公用组件仅在 `registry/components.json` 标记 `approved`、由所有者审查且真正发布后才能被当成正式标准。
- 从 A 项目晋升通用表格到 B 项目使用，必须遵守 `docs/07-组件注册晋升.md`、`docs/08-私有包发布与升级.md`；候选源码不能被当成已发布包。
- Codex、OpenCode、Claude Code 统一使用 `AGENTS.md`，Claude Code 使用轻量 `CLAUDE.md` 导入；所有子 Agent 必须由根 Agent 显式传递准入规则与写权限边界。
- 文档治理 v0.4 不代表现有 v0.3 UI 源码和校验器已升级为可在 GitHub Packages 直接发布/安装的 v0.4 实现。交付需按真实代码与测试结果判定。

---

## 0. 定位与适用原则

RMDL 不是一个固定皮肤或某个框架的模板，而是一套跨项目共享的**产品体验、视觉语言、代码质量、架构边界和交付流程**规范。

**目标**：不同系统各有业务特色，但应当像同一个团队设计、实现和维护的产品。

- **统一底层，不抹平业务**：共享设计 Token、交互习惯、安全规则和工程约束；允许产品独立主题。
- **先解决真实任务，再考虑视觉装饰**：操作效率、可信数据、状态反馈和可访问性优先。
- **模块化单体优先**：先确保模块可测试、可维护；达到必要条件时再拆服务。
- **领域逻辑与接入协议解耦**：HTTP API 是 Host/Adapter，不是业务核心。
- **跨平台与自动交付**：Windows、Linux、Docker 可构建、运行、部署；Jenkins 实现可重现的 CI/CD。
- **默认先进、版本可控**：选用最新合适的正式稳定版本；新版本经兼容验证后升级；绝不在生产自动追逐 `latest`。
- **AI 必须遵守已定规则**：禁止凭模型默认审美和习惯擅自替换组件、ORM、目录和架构。具体执行以本仓库 `AGENTS.md`、`rmdl.project.json`、`policy/` 与检查脚本为准。

规范关键词采用 **MUST（必须）/ SHOULD（应当）/ MAY（可选）**。偏离 MUST 必须先获得项目所有者明确批准，随后在项目 `docs/decisions/` 内记录 ADR（架构决策记录），明确原因、风险、替代方案与批准者。**仅撰写 ADR 不构成授权；AI 不得自批例外。**

### 0.1 范围与非目标

- 本规范是一套**默认标准**，不要求所有项目都部署为微服务，也不强制每个应用使用相同页面布局。
- 本规范不承诺单靠替换数据库连接字符串即可从 SQLite 完美迁移至 PostgreSQL/MariaDB。
- 本规范不要求所有应用同时支持 REST、gRPC、WebSocket、GUI；仅要求业务核心不被某个接入协议锁定。
- SEO 面向公开可索引页面；登录后后台默认不被搜索引擎索引。

---

## 0.2 v0.3 强制治理入口（优先于旧版弹性建议）

1. **新项目 / 整体重构必须先选择、后写代码**。AI 必须向项目所有者展示选择矩阵并等待回复；不能用“默认值”跳过交互。`rmdl.project.json` 从草稿转为锁定后，所有工作者必须遵守。详见 `docs/01-选型与审批协议.md`。
2. **只要存在 Web 前端，技术底座不得因后端语言而变化**：React + TypeScript strict + Bun + HeroUI v3 + Tailwind v4 + Lucide + RMDL Tokens + `@remmai/rmdl-ui`。Next.js 与 Vite 的选择按渲染需求审批，但不得形成两套 UI。
3. **所有 Web 系统共享一个发布版本的 UI 核心包、页面模式与截图基线**。管理后台的框架、页头、工具栏、表格、表单、状态都由公共 UI 包或统一模板提供；业务可以不同，视觉不能任意改。
4. **红线禁止 Agent 自行例外**：新增第二套 UI 库、修改全局主色/字体/圆角、后端更换主 ORM、在重构中扩大改造范围，必须停下申请所有者审批，并记录 ADR。
5. **验证失败就停，不允许降级标准**：`scripts/rmdl.mjs check`、类型检查、Lint、测试、Visual Regression 均为交付门禁；不得自动关闭检查项、删测试、刷新所有截图来宣称通过。
6. **机器门禁与人的权限同时生效**：配置文件及脚本可发现大量违规，但不能证明提交者真的是所有者；因此生产仓库还应配置分支保护、必需 CI、CODEOWNERS/指定审批者。

**规范解释冲突时优先级**：已批准且锁定的项目选型（仅对可选项有效）→ 本文 0.2 红线 / `docs/02-前端视觉与页面契约.md` → 本规范其余强制条款 → 推荐实践 → Agent 个人偏好。锁定配置**不能**覆写红线；红线变更必须先升级 RMDL 标准并由所有者批准。

---

## 1. 技术选型与生命周期

### 1.1 标准技术栈（2026-10-27 基线）

| 层面 | 默认技术 | 说明 |
|---|---|---|
| Web | React + TypeScript（strict） | 持续使用受支持的稳定版本 |
| Web 框架 | Next.js App Router | 面向公开 SEO 页面和具有服务端渲染需要的项目；纯内网控制台可评估 React + Vite |
| JavaScript 工具链 | **Bun** | 默认包管理、脚本、测试及可兼容场景下的运行时；使用 `bun.lock` |
| UI | **HeroUI v3** + Tailwind CSS v4 | 统一组件原语与主题；项目不得随意叠加第二套通用组件库 |
| 图表 | **EvilCharts** | 低/中密度图表优先其 Recharts 实现，高频/大数据优先其 ECharts 实现 |
| 静态图标 | Lucide | 统一图标线宽和尺寸 |
| 动态图标 | **Morphicons** | 用于语义状态转换，不用于无意义装饰 |
| 动画 | **Motion for React** + CSS Transitions | 基础动效 CSS 优先，复杂过渡用 Motion |
| 主后端 | C# + **.NET 10 LTS** + ASP.NET Core | .NET 11 截至本版本制定时仍为 RC；GA 后按版本策略复核 |
| 主要 ORM | **FreeSql（CodeFirst）** | 优先级 FreeSql > EF Core > Dapper |
| 开发数据库 | **SQLite** | 默认零额外数据库依赖 |
| 生产数据库 | PostgreSQL 18 / MariaDB 12.3 LTS（轻型单机可明确选 SQLite） | 按产品选择并进行 Provider 兼容测试；SQLite 生产需记录适用范围 |
| CI/CD | **Jenkins（JKS）** | Jenkinsfile、受控凭据、构建制品、分环境发布与回滚 |
| 容器 | Docker + Compose | 镜像多阶段构建、固定版本和健康检查 |
| API | REST（OpenAPI）、按需 gRPC/SignalR | 只是接入层，不包含独占业务逻辑 |

**版本策略**：每个项目初始化时查询官方发布信息，默认采用可获得的**最新正式稳定 SDK/框架**，优先兼顾长期支持、驱动兼容、安全补丁。具体版本锁定在 `global.json`、锁文件、Docker 基础镜像标签/摘要及版本矩阵文档中。升级通过自动测试、兼容验证和发布审核完成。前端 Bun 与 Next.js/第三方插件不兼容时可记录例外，不将“禁用 Node”理解为牺牲可部署性。

### 1.2 其他后端语言的选型

- **Java**：优先最新正式 GA JDK，并核查目标框架与驱动支持；对长期生产维护可记录选择最新受支持 LTS 的理由。
- **Python**：优先最新正式稳定 CPython，使用项目隔离环境及锁文件；检查核心依赖是否提供兼容包。
- **Node.js**：可由所有者选择作为后端技术，采用受支持的最新合适稳定运行时；后端 ORM 默认 TypeScript + Drizzle。前端开发工具仍统一 Bun。
- 任何技术栈都必须符合模块化、测试、配置、日志、安全、文档、CI/CD 和跨平台原则。

### 1.3 版本治理

- MUST：生产锁定具体依赖及镜像，不使用浮动 `latest` 直接部署。
- MUST：记录 SDK、运行时、数据库、ORM、组件库版本与兼容矩阵。
- MUST：安全补丁优先验证并升级；大版本升级需先在 Staging 验证。
- SHOULD：至少每月检查依赖漏洞与 SDK 支持生命周期。
- MUST：禁止未经验证把 RC、Preview 或 Nightly 作为默认生产基线。

---


### 1.4 不可协商前端与可选后端

| 规则级别 | 项目内容 | 决策权 |
|---|---|---|
| LOCKED | React、TypeScript strict、Bun、HeroUI v3、Tailwind v4、RMDL Core、共享 UI 包 | 标准维护者；项目 Agent 无权改变 |
| CHOOSE_ONCE | Next.js / Vite、后端语言、生产数据库、产品类型、部署方式 | 初始化或整体重构时由项目所有者选择 |
| CONDITIONAL | 各后端的主 ORM / CodeFirst 驱动 | 根据后端语言选默认，例外需所有者 + ADR |
| PER_FEATURE | 图表、SignalR、后台任务、附加存储 | 有业务证据时按项目规范引入 |

- .NET 默认使用 FreeSql + CodeFirst，备选 EF Core 需要先批准 ADR；Dapper 只能做辅助查询。
- Java 默认 Hibernate/JPA 实体映射 + 可审计迁移；Python 默认 SQLAlchemy + Alembic；Node 后端默认 TypeScript + Drizzle；生产均需要版本化数据库迁移，不以开发态自动同步代替。
- 不允许以“某个后端语言更适合 Vue/Angular”作为变更 Web 前端栈的理由。
- 只有明确的**非 Web** 客户端（原生移动/桌面）及无 Web 的纯服务，才能不使用 React Web 栈；不得以此绕过已有 Web 应用统一规范。

---

## 2. 软件架构设计语言

### 2.1 默认架构：模块化单体 + Clean/Hexagonal 原则

结构按**业务模块纵向划分**，每个模块内部再分层，不鼓励无限扩展的公共 `Utils` 或无意义泛型 Repository。

```text
Clients / Experiences
  ├─ React Web / SEO Site
  ├─ Desktop GUI / Mobile App
  └─ CLI / Other Consumers
           │
           ▼
Entry Hosts & Adapters
  ├─ HTTP REST API / WebSocket / gRPC
  ├─ Background Worker / Scheduler
  └─ Desktop or CLI Host
           │
           ▼
Application: Use Cases / Services / Ports / Contracts
           │
           ▼
Domain: Aggregates / Rules / Events / Value Objects
           ▲
           │ interfaces implemented by
Infrastructure: FreeSql / External APIs / Storage / Messaging
```

源码依赖方向：`Domain` 不依赖其他层；`Application` 依赖 Domain 与业务抽象；`Infrastructure` 实现 Application 所需接口；Host 负责组合依赖。示意图中的运行调用方向不等于源码依赖方向。

### 2.2 各层职责

**Domain**

- 实体、值对象、聚合、领域规则、领域事件。
- MUST 不依赖 ASP.NET、FreeSql、数据库、HTTP/GUI 类型。
- 不为简单 CRUD 人为引入复杂的 DDD 机制。

**Application**

- 用例、业务服务、命令/查询处理、事务边界、应用级权限校验、DTO/Contract。
- MUST 不引用 `HttpContext`、Controller、页面组件和具体数据库 Provider。
- 服务可被 REST、gRPC、Worker、CLI 或本地 GUI Host 调用。

**Infrastructure**

- FreeSql 实现、外部 API、文件和对象存储、缓存、消息、邮件。
- 实现 Application 定义的必要接口，聚合数据库配置、事务和连接生命周期。
- Provider 差异由明确的适配器隔离。

**Host / Adapters**

- HTTP API/GRPC Endpoint：鉴权入口、参数绑定、协议映射、标准响应。
- Worker：调度任务、队列消费、后台作业。
- GUI/CLI：在同进程中调用 Application，或通过远程接口连接服务端。
- MUST 不包含不可复用的核心业务决策。

**重要区分**：Android/iOS App、React Web 是客户端，不是 HTTP API 的替代品；可以给同一 Application 增加新的 Host/Adapter，而不是把 APK 与 gRPC 当作同一层的等价产物。

### 2.3 工程组织原则

- 默认一个仓库、一个后端解决方案、一个前端工作区，按业务模块拆分。
- 小项目可合并物理程序集，**不能破坏逻辑边界**。
- 复杂业务可演化为独立服务，但必须有量化理由（独立伸缩、发布、数据隔离或组织边界）。
- 避免循环依赖和“所有模块共用一个巨型 Common”。
- 共享库只承载稳定、跨项目真正通用的能力；业务 DTO 不进入基础 UI 库。
- 服务间通信必须设计超时、取消、重试、幂等与可观测性。

### 2.4 API 与契约

- REST：OpenAPI 规范及版本策略；统一错误格式（优先 RFC 9457 Problem Details）。
- gRPC：版本化 `.proto` 契约；兼容字段演进。
- WebSocket/SignalR：仅用于确有实时性的场景，并定义重连与鉴权。
- 共享 Contract 不是共享 Domain Entity；禁止直接将数据库实体暴露给外部调用者。
- 列表查询统一分页、排序、过滤边界；写操作明确幂等性与冲突状态。
- API 输入服务端验证；前端验证只改善体验。

---

## 3. ORM、CodeFirst 和数据库规范

### 3.1 强制选型优先级

**FreeSql > EF Core > Dapper**。

1. **FreeSql：默认且优先使用，必须开启规范化 CodeFirst 流程。**
2. **EF Core：当 FreeSql 无法满足 Provider、功能、运维或兼容需求时使用，需 ADR。**
3. **Dapper：无原生完整 CodeFirst，不能单独担任要求 CodeFirst 的主 ORM；仅用作有证据支持的复杂 SQL/读性能优化。**

MUST：核心业务层不得直接依赖 ORM。Infrastructure 层可以使用 `IFreeSql`、具体查询 API，不必为每张表机械生成 IRepository。

### 3.2 开发与生产数据库

**开发环境：SQLite**

- 零独立 DB Server、可在 Windows/Linux 本地与 CI 运行。
- CodeFirst 允许显式启用自动初始化/同步，仅限受控开发数据库。
- 临时测试推荐独立数据文件或 SQLite in-memory（根据测试生命周期选择）。
- 禁止把 SQLite 的并发、类型或 SQL 行为视作生产数据库的完整模拟。

**生产环境：PostgreSQL / MariaDB（常规）或经所有者明确选定的 SQLite（轻型单机）**

- 选择明确的 Provider，兼容 FreeSql 对应驱动及服务器版本。
- 生产环境**必须禁用自动 Schema 同步**；FreeSql 官方自动同步选项默认行为必须在配置中显式覆盖。
- 迁移脚本经审查后，由独立 `DbMigrator`/Jenkins 部署阶段执行。
- 要有 Schema 版本记录、校验、备份、迁移日志及失败处理。
- 破坏性迁移（删表、改类型）采用 expand/contract 或维护窗口方案。

### 3.3 CodeFirst 的界限

- MUST：实体/Fluent 配置定义主键、索引、约束、精度、长度、唯一性。
- SHOULD：代码先行生成变更计划，再审查 DDL，生产只执行经批准的脚本。
- MUST：数据库变更是版本化发布制品的一部分，不是应用启动副作用。
- MUST：在真实目标 Provider 上执行迁移与 CRUD/事务集成测试。
- 不承诺 FreeSql 提供与 EF Core 完全相同的迁移机制；项目必须实现清晰可审计的迁移策略。

### 3.4 跨数据库兼容性

需在测试中覆盖：

- `decimal` 精度、日期与时区、GUID、JSON、大小写/排序规则、布尔与空值。
- 自增/序列、唯一约束、外键、索引、分页、UPSERT、批量操作。
- 并发事务、隔离级别、死锁、连接池、超时。
- Provider 特有 SQL 仅可封装在 Infrastructure；必须有跨库替代或显式限制。

### 3.5 时序与 KV 数据

**轻量阶段**：优先复用 SQLite，采用 `Timestamp + SeriesId` 等索引设计；适合小体量时间序列写入和查询。

**KV/嵌入式**：如确实需要独立 KV 模型，可评估 LiteDB、RocksDB 等；它们不等同于时序数据库，也不能直接替换关系型 ORM。

**分析型本地数据**：可评估 DuckDB，但它不是通用事务型主数据库。

**生产时序**：依据保留策略、压缩、降采样、写入量、查询模式评估 PostgreSQL 时序扩展、InfluxDB 等，不因为“时序”二字默认新增组件。

---

## 4. RMDL 视觉身份与设计原则

### 4.1 品牌设计气质：Young Tech

**年轻（Youthful）· 清爽（Fresh）· 专业（Professional）· 精确（Precise）· 有活力（Energetic）**。

- 核心设计方向：**明快的色彩 + 清晰的信息架构 + 轻盈但稳定的交互**。
- 年轻感来自品牌识别、适度的饱和度、微妙的明暗变化和精心控制的视觉节奏，而不是大量霓虹、紫蓝渐变、玻璃效果。
- 允许品牌色在导航选中、主要按钮、焦点框和关键数据上形成统一视觉锚点；大型数据区域以中性色保证可读性。
- 保留「专业工具」的可靠感，同时避免默认采用过深、过灰的商务配色。
- 界面结构由信息架构和用户任务决定，不由组件库演示页决定。
- 导航、表单、表格、反馈、加载与错误态保持跨系统一致。

### 4.2 双层品牌体系

**RMDL Core**（所有系统共享）：字体层级、语义色、间距、形状、交互、无障碍、基础组件、状态表达。

**RMDL Themes**（可扩展）：

- `rmdl-admin`：高信息密度工具型后台；蓝色主操作 + 冷白中性背景，少量薄荷绿提示运行状态。
- `rmdl-portal`：公开用户门户；可适度提高背景明度、留白及品牌色使用比例。
- `rmdl-data`：图表/表格优先；使用可区分的系列色，减少无关高饱和背景。
- `rmdl-game`：可以使用珊瑚橙红、游戏资产或物品图标形成局部个性；不得随意替换全局语义色。
- `rmdl-content`：博客及展示页面允许更自由的色块、排版和插画，但字体及交互规则维持一致。

主题只能替换受控 Token、特定资产和业务图案，不能重新定义错误、警告、成功等状态的含义。

### 4.3 Young Tech 核心色板（v0.2）

**品牌配色：活力蓝 `#245CF5` + 薄荷绿 `#0DBFA5` + 珊瑚橙红 `#FF6B78`。**

主色强调产品与主要操作；薄荷绿是辅助品牌装饰色（并不自动意味着成功）；珊瑚色为小面积情绪和视觉亮点（并不自动意味着错误）。**视觉强调色与语义状态色必须分开**。

| 语义 Token | Light | Dark | 使用场景 |
|---|---|---|---|
| `bg.canvas` | `#F7F9FF` | `#101624` | 页面背景；偏清爽冷白/深夜蓝 |
| `bg.surface` | `#FFFFFF` | `#192235` | 内容面板、列表、表单 |
| `bg.elevated` | `#FFFFFF` | `#232F46` | 浮层、菜单、对话框 |
| `fg.primary` | `#172136` | `#F3F6FF` | 主要正文/标题 |
| `fg.secondary` | `#5C687E` | `#A9B9D1` | 次级正文/说明 |
| `border.default` | `#E3EAF4` | `#344258` | 边框/分隔线 |
| `brand.primary` | `#245CF5` | `#86ADFF` | 主操作、选中、链接及焦点 |
| `brand.primaryHover` | `#1D4FCC` | `#A3BEFF` | 主交互 Hover |
| `brand.onPrimary` | `#FFFFFF` | `#101624` | 主色底上的文字/图标 |
| `brand.secondary` | `#0DBFA5` | `#42D8BD` | 品牌辅色、数据装饰、非语义强调 |
| `brand.accent` | `#FF6B78` | `#FF8B91` | 珊瑚色强调、局部装饰 |
| `status.success` | `#087F7A` | `#42D8BD` | 成功状态的可读文字/图标 |
| `status.warning` | `#A66900` | `#EAB84F` | 警告状态的可读文字/图标 |
| `status.danger` | `#C92D49` | `#FF8B91` | 错误/危险状态的可读文字/图标 |

**使用比例建议（仅作为设计检查起点，不作为硬性配额）**：中性色约 75–85%，主要品牌蓝约 10–20%，薄荷绿和珊瑚色合计约 5% 或更少。复杂管理后台应更加克制；品牌展示页可以适当突破比例。

**对比度基线**：`#245CF5` 上的白色文字对比度约为 **5.35:1**；`#087F7A` 在白色上的对比度约为 **4.85:1**；`#C92D49` 在白色上的对比度约为 **5.31:1**。这些仅验证了明确列举的颜色配对，其他实际组合（包括半透明背景、禁用态、Hover、图表标签）仍须自动测试。`#0DBFA5` 和 `#FF6B78` **不得直接当作浅色背景上的小号文本颜色**。

- 颜色表示**语义**，不得仅靠颜色传递状态；必须配合文本或图标。
- 普通文本至少 4.5:1；大字至少 3:1；关键交互边界/状态满足相应非文本对比度要求（WCAG 2.2 AA）。
- 禁止把珊瑚色直接等同于 `danger`，把薄荷绿直接等同于 `success`；语义 Token 必须独立定义。
- 图表系列颜色须兼顾色觉差异、黑白打印和图例可辨性，推荐基础系列色：`#245CF5`、`#087F7A`、`#C92D49`、`#A66900`、`#7657B9`、`#087FA3`，并以形状/标签作冗余编码。图表颜色不等于状态颜色。

### 4.4 排版与布局 Token

| 类型 | 默认规范 |
|---|---|
| 字体 | `Inter`（西文）+ `Noto Sans SC`（中文）+ 系统字体回退；跨平台可用性优先 |
| 正文 | 工具型后台 14px；阅读/门户 16px |
| 文字层级 | 12 / 14 / 16 / 18 / 24 / 32px，禁止无规律生成字号 |
| 基准间距 | 4px；使用 4 / 8 / 12 / 16 / 24 / 32 / 48px |
| 圆角 | **8 / 12 / 16px**，略微轻盈，但不允许所有区域统一使用大圆角 |
| 布局 | 8/12 栏按实际场景选择；禁止所有内容等宽平均分布 |
| 后台侧栏 | 约 224–256px，支持折叠 |
| 顶栏 | 约 52–64px |
| 桌面表格行高 | 紧凑 36–40px、标准 44–48px |
| 移动点击目标 | 尽量达到 44×44px，满足无障碍与平台要求 |

品牌应由统一的颜色、图标尺寸、排版节奏与状态反馈产生识别，而不是靠不断扩大圆角、渐变面积或组件高度。CSS Variables 作为色彩权威源，Tailwind/HeroUI/EvilCharts 通过各自适配层消费这些语义 Token。

### 4.5 色彩在组件中的应用

- **按钮**：Primary 使用 `brand.primary`，避免一屏出现多个竞争性的高饱和主按钮；Secondary 通常采用中性底色/边框。
- **侧栏导航**：以文本层级为主，激活项使用浅蓝选中底/蓝色标识，禁止整条侧栏大面积高饱和铺色。
- **链接/焦点**：优先品牌蓝；所有焦点状态都有可辨认的轮廓或焦点环。
- **表单**：默认采用浅背景、中性边界；错误和成功使用语义 Token，且同时有文字提示。
- **数据表格**：表头和行保持中性；操作列突出必要动作；不要隔行堆放高彩色背景。
- **图表**：系列色按视觉区分用途使用；不得用品牌珊瑚色冒充错误状态，也不得只通过颜色标记曲线。
- **深色模式**：使用真正的层级深蓝，不直接将 Light 颜色机械反相；高饱和强调色应专门校准。

**UI 审美约束**：禁止无业务意义的大面积渐变、发光边框、玻璃拟态、假数据装饰图表和千篇一律的 KPI 卡片。允许适度柔和底色、局部品牌色、轻微浮层阴影和有意义的动效；以真实屏幕与组件状态验收为准。

### 4.6 代码落地与主题映射

- 全局语义变量统一使用 `--rmdl-*` 前缀，避免将十六进制颜色硬编码散落在组件中。
- 将设计 Token 存放在 `packages/tokens/` 或 `apps/web/src/design/`，由前端框架适配层映射到 Tailwind CSS、HeroUI 和 EvilCharts。
- 深色模式使用一致的根节点主题属性（建议 `data-theme="dark"`），避免多个子系统同时维护不同主题切换机制。
- 设计 Token 更新必须检查 Light、Dark、Hover、Focus、Disabled、Loading、Error 等实际状态。
- 必须使用本仓库受控的 `packages/tokens/rmdl-colors.css`（或发布的同版本 Token 包）作为色彩基础文件，项目可按其映射 HeroUI 所要求的版本化主题变量，而不是直接假定 HeroUI 的变量名称与 RMDL 相同。

---

## 5. 前端工程化标准

### 5.1 组件生态

- MUST：强制 HeroUI v3 + Tailwind CSS v4；业务组件封装在 RMDL 组件层。
- SHOULD：Lucide 负责常规图标，Morphicons 只做语义图标形态变化。
- SHOULD：EvilCharts 用于实际有数据分析意义的图表。
- MUST：EvilCharts 引入的 shadcn 风格及 Token 需通过 RMDL Adapter 映射；不得污染 HeroUI 全局主题。
- MAY：简单动画使用 CSS；复杂入场、退出、布局变化使用 Motion for React。
- MUST：不得同时引入多个库来完成完全相同的组件职责，除非有明确业务例外。

### 5.2 Bun 使用原则

- `bun.lock` 纳入版本控制。
- CI 使用 `bun install --frozen-lockfile`。
- 常用脚本：`bun run dev`、`bun run lint`、`bun run typecheck`、`bun run test`、`bun run build`。
- Bun 作为优先运行时和工具链；若 Next.js/第三方包存在实测兼容问题，可以限定范围回退 Node 运行时，并写入 ADR。
- 禁止混用 npm/pnpm/yarn 的锁文件来维护同一工作区。

### 5.3 TypeScript 与模块边界

- MUST：启用 TypeScript strict，禁止滥用 `any`、`@ts-ignore`、全局单例可变状态。
- 按功能模块组织页面、Hook、服务适配、状态、组件和测试。
- Server State 优先 TanStack Query 等请求缓存方案（视框架实际情况选用）。
- 轻量 UI State 优先本地状态；复杂共享状态可引入 Zustand。
- 表单可使用 React Hook Form + Zod，并遵守后端最终验证。
- 不在组件内直接拼接复杂 API URL 和业务权限逻辑。
- 不重复维护后端契约；优先从 OpenAPI 生成类型或使用版本化共享契约。

### 5.4 注释与文档

- 页面模板、简单声明式 JSX 不强制加入重复性注释。
- **JavaScript/TypeScript 业务函数必须标注功能意图**：公开函数优先 TSDoc；非平凡函数说明输入、输出、副作用、失败条件；简单 getter/映射函数允许简短说明。
- 不使用“这行代码给变量赋值”等无价值注释。
- 对跨模块交互、复杂算法、权限规则、缓存失效策略编写 Markdown 文档与测试。
- 文档优先说明**为什么这样设计**，代码注释补充局部非显然逻辑。

### 5.5 SEO 与页面渲染

**公开 Web 页面**：

- Next.js SSR/SSG/ISR 依据内容变化频率选择。
- 每页唯一 title/description/canonical，必要时使用 Open Graph、站点地图、robots、结构化数据。
- 语义 HTML、有效 heading 层级、图片替代文本、可抓取链接及合理加载性能。
- 避免把核心公开内容放在仅客户端运行后才能生成的页面里。

**登录后的私有后台**：

- 默认 `noindex`，不将内部业务资料开放给搜索引擎。
- 优先应用交互性能、导航可用性和数据安全；无需为全部私有页面强制 SSR。

### 5.6 性能与响应

- Core Web Vitals 作为公网体验监控指标；目标为 LCP ≤2.5s、INP ≤200ms、CLS ≤0.1（在合适测试口径下评估）。
- 按路由/模块拆包；图表和富编辑器延迟加载；首屏不加载无关大库。
- 大表格使用服务端分页或虚拟滚动，不一次性渲染大量 DOM。
- 请求取消、搜索防抖、缓存失效、乐观更新必须根据业务风险设计。
- 需要展示加载、空状态、错误、无权限、网络中断、成功、冲突等情况。
- 禁止为了动效牺牲输入响应和页面滚动。

---

## 6. 统一组件、交互与动画语言

### 6.1 核心组件清单

`AppShell`、`AppSidebar`、`AppPage`、`AppPageHeader`、`AppToolbar`、`AppSection`、`AppButton`、`AppInput`、`AppSelect`、`AppForm`、`AppDataTable`、`AppFilterBar`、`AppStatus`、`AppDialog`、`AppDrawer`、`AppToast`、`AppEmptyState`、`AppErrorState`、`AppSkeleton`、`AppChart`、`AppPermissionGate`。

- 对项目页面**必须优先使用版本化 `@remmai/rmdl-ui` 公共组件**。公共组件内部组合 HeroUI v3 原语；不得由各产品独立复刻 AppShell、AppPageHeader、AppDataTable 等基础组件。封装必须承载统一行为、样式或语义。
- 公共组件不得依赖某个具体业务实体。
- 组件必须有尺寸、变体、状态、键盘交互、无障碍和深浅色规范。

### 6.2 页面模式

- **列表**：标题与主操作、筛选区、数据区、批量操作、分页、空/错/加载状态。
- **详情**：身份/状态摘要、核心信息、关联记录、时间线、主次操作。
- **编辑**：分组字段、实时可理解校验、保存状态、离开提醒、危险操作隔离。
- **仪表盘**：只呈现真实可行动的指标；优先趋势、异常、待办，不默认四张数据卡。
- **审核/任务**：状态流转可视化、决策说明、责任人、操作日志及可撤销性。
- **玩家/游戏**：专属主题只改变品牌表达，不改变表单和权限操作的一致性。

### 6.3 动效 Token

| Token | 建议值 | 用途 |
|---|---:|---|
| `motion.instant` | 80ms | 非关键状态反馈 |
| `motion.fast` | 140ms | Hover、焦点、轻量切换 |
| `motion.normal` | 220ms | 菜单/弹层、内容切换 |
| `motion.slow` | 320ms | 较大区域进入/布局调整 |

- 动画必须说明“什么状态发生了改变”，而不是单纯吸引注意。
- 多组件连续动画应有一致缓动曲线，不得随机设置 Spring 参数。
- 遵循 `prefers-reduced-motion`；Motion、Morphicons 均需启用尊重系统偏好的配置。
- 高频数据表格、页面滚动及重要确认过程避免过度动画。

### 6.4 深色模式与可访问性

- 原则上所有基础组件支持 Light/Dark。
- 焦点状态清晰可见、支持键盘导航与可识别的错误文本。
- 图标按钮必须提供可访问名称；状态不能仅通过颜色区分。
- Modal/Drawer 需要焦点管理、Esc/关闭行为和遮罩交互一致性。
- 测试目标采用 WCAG 2.2 AA；移动端同时遵守平台交互规范。

---


### 6.5 强制公共设计与页面密度契约（v0.3）

- **单一组件权威源**：`@remmai/rmdl-ui`（以已发布版本或经锁定 commit/digest 的源码依赖交付）；每个产品不得自行复制实现与手动改色。
- **管理后台默认同一个壳**：侧栏、顶栏、页边距、标题/副标题、筛选栏、列表与反馈区统一复用，不依赖 Agent 的设计灵感。
- **默认正文信息密度**：一页一个 H1，头部一条简短用途说明（可没有），一个主操作；能用表格/简洁表单时禁止把每条数据包装成大 Card。
- **正文是完成任务的界面，不是产品介绍文案**：禁止重复标题、操作指南段落堆砌、装饰性指标卡、无业务意义的欢迎区和占位图表。
- **每个新页面先选登记过的页面模式**：`list/detail/form/dashboard/workflow`；不得自由设计与现有模式不同的通用布局。
- **响应式、空/错/加载态**由公共组件承担，不得各页面各自实现不同措辞/样式；业务文案可以不同。
- **两个后台如何做到相同**：除了共同的色号，必须使用相同版本的组件包、相同页面模式、设计截图基线、Linter 和截图对比门禁。

逐项阈值、组件责任划分、文案预算及拒收示例以 `docs/02-前端视觉与页面契约.md` 为准。

---

## 7. 身份认证、RBAC 与动态菜单

### 7.1 权限模型

基线实体：`User`、`Role`、`Permission`、`UserRole`、`RolePermission`；按需要增加 `ResourceScope`、`Organization`、`Tenant`、`AuditLog`。

权限命名建议：`resource:action`，如 `invoice:read`、`invoice:write`、`jobs:execute`、`users:manage`。

MUST：后端为权限唯一可信执行点。**前端菜单隐藏和按钮隐藏仅是 UX，不是安全控制。**

### 7.2 动态菜单机制

- 登录后从后端获得身份、角色、有效 Permission 集合与允许显示的菜单信息，或获取权限并对版本化菜单定义过滤。
- 菜单项具有稳定的 `id`、`parentId`、`route`、`order`、`iconKey`、`requiredPermissions`、`visibility`。
- 不直接信任后端传入任意组件名或可执行路由，客户端路由在可信映射表中解析。
- 页面、导航、按钮和 API 使用同一权限标识；服务端接口再次独立校验。
- 默认拒绝（deny-by-default）；权限数据加载前不短暂显示受限功能。
- 菜单支持嵌套、排序、国际化、可访问性、移动端收起与路由高亮。
- 角色/权限变更后支持会话刷新与缓存失效；敏感操作重新验证。
- 多租户或数据行级权限不是单纯 RBAC 可以解决的，须按资源作用域做授权校验。

### 7.3 用户体验规则

- 无权限菜单不展示；直接访问受限路由显示明确 403，不泄露数据。
- 仅只读权限时可展示只读视图，不允许通过禁用按钮代替后端授权。
- 权限变更、重要管理操作进入审计日志。

---

## 8. 跨平台部署与交付

### 8.1 目标部署形态

- **Windows**：.NET 应用可作为控制台、服务或独立发布包运行；Web 前端根据 Next.js/Bun 运行模式部署。
- **Linux**：systemd（原生进程）或容器部署，服务环境变量/文件权限明确。
- **Docker**：作为默认服务器部署格式，采用多阶段构建、非 root 运行、只读和持久化策略（适用时）。
- 同一代码仓库可产出不同目标的制品，但不宣称“单个二进制直接通用所有平台”。

### 8.2 Docker/Compose

- 镜像版本与 digest 受控；多阶段构建、最小化运行镜像。
- 数据/日志/证书通过卷或安全存储托管，容器无状态化优先。
- 提供 `healthz`、`readyz`、优雅退出、停止超时和重启策略。
- 只有必要端口暴露公网；数据库默认处于私有网络。
- 生产镜像不内置明文凭据及开发调试工具。
- 备份策略必须验证恢复，不仅是定期生成备份文件。

### 8.3 Jenkins（JKS）流水线

推荐 `Jenkinsfile`（Pipeline as Code），并使用 Jenkins 凭据系统管理 Secret。

```text
Checkout
  → Verify SDK / Dependency Lockfiles
  → Format / Lint / Static Checks
  → Unit Tests
  → SQLite Integration Tests
  → PostgreSQL / MariaDB Provider Tests (as applicable)
  → Frontend Typecheck / Tests / Build
  → API Contract Tests / E2E / Screenshot Review
  → Security / Dependency Scan
  → Build Signed or Traceable Artifacts
  → Publish Versioned Artifacts & Container Images
  → Staging Deploy
  → Database Migration Review & Apply
  → Smoke Tests / Health Checks
  → Production Approval / Deploy
  → Post-deploy Checks / Rollback on Failure
```

- Windows/Linux Jenkins Agent 应覆盖对应原生发布目标；容器镜像可由受控 Linux Agent 构建。
- 所有制品附带 commit SHA、构建时间、工具链版本和变更记录。
- 生产发布建议人工批准或受保护环境审批；支持回滚到已知可用版本。
- 数据库迁移回滚不等同于容器回滚，必须单独设计数据兼容策略。
- 流水线测试失败必须阻断部署，不允许 AI 自动跳过失败测试。

### 8.4 配置与密钥

- 配置层级：默认配置 → 环境配置 → 密钥注入；禁止在仓库提交真实密钥。
- 使用 `.env.example`、配置 Schema、环境说明文档。
- 日志中遮蔽 Token、Cookie、密码和敏感个人信息。
- 应用提供时间戳、关联 ID、审计事件和健康指标。

---

## 9. 项目目录与代码组织

统一结构是**参考架构**，小项目允许删减空目录，不允许为迎合目录模板制造空项目。

```text
remmai-product/
├── README.md
├── RMDL.md
├── AGENTS.md
├── global.json
├── .editorconfig
├── .gitignore
├── .env.example
├── bun.lock                  # 若前端位于同一仓库根工作区
├── Jenkinsfile
├── docker-compose.yml
├── docs/
│   ├── architecture.md
│   ├── development.md
│   ├── deployment.md
│   ├── api.md
│   ├── permissions.md
│   ├── database.md
│   ├── ui-design.md
│   ├── operations.md
│   ├── changelog.md
│   └── decisions/
├── apps/
│   └── web/                  # React / Next.js / Bun
│       ├── src/
│       │   ├── app/          # App Router routes/layouts
│       │   ├── features/     # business-first modules
│       │   ├── components/   # shared app components
│       │   ├── design/       # RMDL tokens/theme adapters
│       │   ├── lib/          # bounded infrastructure helpers
│       │   └── generated/    # generated contracts, no manual edits
│       ├── public/
│       └── tests/
├── packages/
│   ├── ui/                   # cross-product RMDL UI when extracted
│   ├── tokens/
│   └── contracts/            # generated/shared types if needed
├── backend/
│   ├── RemMai.slnx
│   ├── src/
│   │   ├── RemMai.Domain/
│   │   ├── RemMai.Application/
│   │   ├── RemMai.Infrastructure/
│   │   ├── RemMai.Host.Api/
│   │   ├── RemMai.Host.Worker/
│   │   └── RemMai.Host.DbMigrator/
│   └── tests/
│       ├── UnitTests/
│       ├── IntegrationTests/
│       └── ArchitectureTests/
├── deploy/
│   ├── docker/
│   ├── windows/
│   ├── linux/
│   └── migrations/
└── scripts/
```

若已经使用根 `bun.lock` 管理 workspace，不再在子项目维护冲突锁文件。`*.slnx` 是否可用、相关 SDK/IDE 是否支持，依具体开发环境验证。

### 9.1 命名约定

- C# 类型/方法 `PascalCase`；局部变量 `camelCase`；接口 `IName`。
- TypeScript 组件 `PascalCase`、Hook `useXxx`、函数变量 `camelCase`。
- 目录优先业务名（`billing`, `jobs`, `users`），避免泛化 `misc`, `helpers`, `common2`。
- API 路径使用稳定的资源名；数据库命名统一风格，不能一个项目混用多套命名习惯。

---

## 10. 测试、质量与安全基线

### 10.1 必须具备的测试

- **Unit**：Domain 规则、Application 用例、权限决策。
- **Integration**：FreeSql/SQLite 和目标生产数据库 Provider，迁移、事务、分页、并发。
- **Contract**：OpenAPI/gRPC Schema 与客户端兼容性。
- **E2E**：登录、权限、核心业务流程、异常恢复；推荐 Playwright。
- **Visual Regression**：设计系统核心组件和主要页面的桌面/移动截图比较。
- **Architecture Tests**：验证模块依赖方向与禁止跨层引用。

### 10.2 前端验收

- Chrome、Firefox、Safari 等实际目标浏览器按项目覆盖。
- 响应式至少验证手机、平板、桌面典型宽度。
- 支持键盘操作、焦点状态、减少动态效果和对比度检测。
- 检查空表、长文本、大数字、慢网络、权限不足、请求失败。
- 页面必须采用统一视觉体系，不能仅以“编译成功”作为 UI 完成标准。

### 10.3 后端验收

- API 错误契约、认证授权、超时取消、日志追踪与健康检查。
- 涉及金额使用 decimal，时间存储明确 UTC 与展示时区规范。
- 所有外部输入和 SQL 参数经过验证/参数化处理。
- 重要写操作考虑乐观并发、幂等和重复提交。
- 关键路径必须有性能测量，不凭直觉作优化。

### 10.4 安全与隐私

- 使用最小权限、CSRF（Cookie 场景）、CORS 白名单、可信反向代理配置。
- 根据认证方式决定 Token 保存、刷新与撤销策略；不随意把长期凭证放在 `localStorage`。
- 记录依赖漏洞、许可证、SBOM/构建信息（项目规模允许时）。
- 日志脱敏，定义备份保留、用户数据生命周期和访问审计。

---

## 11. 文档标准与可维护性

每个项目最低需要：

1. `README.md`：定位、启动方式、主要入口。
2. `docs/architecture.md`：模块图、依赖关系、关键边界。
3. `docs/development.md`：SDK 版本、Bun/.NET 命令、环境搭建。
4. `docs/database.md`：Provider、CodeFirst、迁移及测试机制。
5. `docs/permissions.md`：RBAC 资源和权限编码、菜单契约。
6. `docs/ui-design.md`：所用主题、Token 扩展、页面模式。
7. `docs/deployment.md`：Windows/Linux/Docker、Jenkins 发布与回滚。
8. `docs/operations.md`：健康检查、日志、备份、故障排查。
9. `docs/decisions/`：偏离规范和主要技术决策。

应当遵守：文档与实现同 PR 更新；用示例命令说明；不重复复制自动生成代码；不把注释当作文档替代品。

---

## 12. AI / Codex 执行协议

### 12.1 任务开始

- **若任务为初始化或整体重构**：必须执行 `docs/01-选型与审批协议.md`，展示选项并等待所有者选择。尚未批准时，仅允许调查、方案与草稿，禁止生成或批量改动业务代码。
- **若任务为常规开发**：读取且服从已经锁定的 `rmdl.project.json`，不得重新解释技术选型。
- 先读取本 `RMDL.md`、`AGENTS.md`、与本任务相关的文档和模块。
- 先进行小范围目标搜索，禁止无意义全仓扫描。
- 只需要简短列出：目标、涉及文件/模块、关键约束、验证方式。
- 如发现规范与业务冲突，说明冲突并提交 ADR 草案，不自行绕过规范。

### 12.2 编码阶段

- MUST：任何 Web 前端遵守 React + TS strict + Bun + HeroUI v3 + RMDL；后端遵守已批准的语言选型；选择 .NET 时默认 FreeSql CodeFirst。
- MUST：保持 Service/Application 与 API/Host 分离。
- MUST：前端菜单按有效 RBAC 渲染，后端实施真实授权。
- MUST：复用统一发布的 RMDL Tokens 和 `@remmai/rmdl-ui` 组件，禁止重造基础 UI 风格。
- MUST：页面遵循 `docs/02-前端视觉与页面契约.md`；禁止无意义长说明、重复 Card、多个主按钮及不同后台自建外观。
- MUST：UI 需求必须经过静态检查、视觉快照和人工页面评审；静态检查不能代替视觉验收。
- MUST：JavaScript/TypeScript 非平凡函数写明功能意图及特殊行为；模板不堆砌无用注释。
- SHOULD：小步增量修改，只扩展直接需要的抽象。
- MUST：数据变更考虑生产迁移，不开启生产自动 SyncStructure。
- MUST：更新受影响文档和测试；不得把编译成功等同于验收通过。

### 12.3 交付阶段

- 报告变更点、影响模块、测试结果、风险和未完成项。
- 前端展示关键页面截图或报告浏览器 UI 审查结果（工具可用时）。
- 数据迁移、权限、安全、发布变更必须单独标明。
- 禁止虚报已运行的测试或伪造视觉验收。

---

## 13. 新项目验收门槛（Definition of Done）

- [ ] 已确定最新合适稳定 SDK，并锁定具体版本与依赖。
- [ ] Domain/Application/Infrastructure/Host 边界清晰且依赖检查通过。
- [ ] 已按所选后端语言使用主 ORM 和 CodeFirst；若为 .NET 则默认 FreeSql；开发环境 SQLite 可初始化（适用时）。
- [ ] 生产 Provider、迁移流程与集成测试已验证。
- [ ] 若存在 Web 前端，React/TypeScript strict/Bun/HeroUI v3/Tailwind v4/RMDL UI 包为统一核心；EvilCharts/Morphicons/Motion 按需使用。
- [ ] 统一 RMDL Tokens，Light/Dark 和响应式表现正常。
- [ ] RBAC 同时控制前端表现与后端真实权限。
- [ ] 公开页面 SEO 或私有页面 noindex 策略正确。
- [ ] Loading/Empty/Error/Forbidden/Success 等状态完整。
- [ ] Typecheck、Lint、Unit、Integration、E2E 及相关视觉检查通过。
- [ ] Windows/Linux 目标可发布；Docker Compose 能正常启动与健康检查。
- [ ] Jenkinsfile 可自动完成构建、验证、发布和必要的回滚流程。
- [ ] 密钥、日志、备份、审计及最小权限符合规范。
- [ ] README、架构、数据库、权限、部署、运维文档齐全且与代码一致。
- [ ] 所有偏离强制规范的事项均有 ADR。

---

## 14. 建议的分阶段落地

**阶段 A — Design Foundation**：采用 Young Tech 色彩方案，确定 Token/字体/间距/形状、HeroUI 主题、基础组件、暗色模式、交互和动效规则。

**阶段 B — Application Starter**：建立 React+Bun 前端模板、.NET+FreeSql 后端模板、SQLite、本地配置、RBAC、OpenAPI、基础测试。

**阶段 C — Delivery**：完成 Docker Compose、Windows/Linux 发布、Jenkinsfile、生产数据库迁移与 Staging 验证。

**阶段 D — 批量迁移**：选择 1–2 个典型现有系统先迁移，提炼稳定组件后再推广到其他系统。

规范演进采用 SemVer：补充/澄清为修订版本，重大不兼容设计或工程约束更新为大版本。每次修改维护版本记录与受影响项目清单。

---

## 15. 参考资料（截至 2026-10-27）

- [.NET 官方下载](https://dotnet.microsoft.com/en-us/download/dotnet) · [.NET 支持政策](https://dotnet.microsoft.com/en-us/platform/support/policy)
- [FreeSql CodeFirst](https://freesql.net/en/guide/code-first.html) · [FreeSql 项目](https://github.com/dotnetcore/FreeSql)
- [HeroUI v3](https://heroui.com/en/docs/react/releases/v3-0-0) · [HeroUI Releases](https://heroui.com/en/docs/react/releases)
- [EvilCharts](https://evilcharts.com/docs) · [Morphicons](https://www.morphicons.com/docs)
- [Motion for React](https://motion.dev/docs/react) · [Motion 无障碍](https://motion.dev/docs/react-accessibility)
- [Bun 文档](https://bun.sh/docs) · [Next.js Metadata](https://nextjs.org/learn/dashboard-app/adding-metadata)
- [Jenkins Pipeline](https://www.jenkins.io/doc/book/pipeline/)
- [PostgreSQL 发布说明](https://www.postgresql.org/docs/release/) · [MariaDB 12.3 LTS](https://mariadb.org/mariadb-server-12-3-lts-released/)

**版本说明**：本版技术快照采用 .NET 10 LTS、PostgreSQL 18、MariaDB 12.3 LTS；新项目启动时必须重新确认正式 GA、支持周期与 Provider 兼容情况，而非永久锁死这些大版本。


---

## 16. 修订记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v0.1 | 2026-10-27 | 首次整合全栈设计语言与工程化规范 |
| **v0.2** | **2026-10-28** | 将视觉语言调整为 **Young Tech**；采用活力蓝、薄荷绿、珊瑚色；重构 Light/Dark 色彩 Token、组件使用规则与对比度约束；其他技术与架构基线不变 |
| **v0.3.0** | **2026-11-02** | 增加初始化/重构选型、所有者审批锁、React 前端不变量、统一组件源、页面简洁度契约、Agent 分工、静态门禁和视觉验收 |
