# 15 — 后端权限与 Authentik 双模认证标准

> 适用于 RMDL 规范下各业务系统后端的认证与授权设计（以 .NET + FreeSql 为基准参考实现，其他语言后端保持相同契约与状态机）。

---

## 一、双模架构与模式切换

业务系统在不同部署环境下，支持两种严格互斥的身份认证模式，通过配置 `Auth:Mode` 切换：

| 模式标识 | 登录方式 | 内置 admin 账号 | 第一个 Authentik 用户 | 角色与权限归属 |
|---|---|---|---|---|
| **`LocalRbac`** (自管模式) | 账号 + 密码 | 强制存在，具有 `*` 最高权限 | 不可用 | 业务后台自管角色与权限点 |
| **`AuthentikOauth`** (SSO 模式) | 仅 Authentik OAuth/OIDC | **强制禁用账密登录**，封禁本地 admin | **自动提权为 Admin** | 优先 Authentik 组同步，次选后台自管 |

### 强制安全红线

1. **模式隔离**：系统处于 `AuthentikOauth` 模式时，`/api/auth/login`（密码登录接口）**必须返回 403 Forbidden**，严禁接受密码凭据碰撞。
2. **凭据安全**：自管密码必须使用加盐单向哈希（PBKDF2 / Argon2 / BCrypt），禁止 MD5 或明文。Authentik 模式下用户表的 `PasswordHash` 必须置空。
3. **真实后端拦截**：前端菜单与按钮隐藏仅属于 UX 展示，后端 API 必须通过中间件或 EndpointFilter 校验 Token 与 Permission 集合（通配符 `*` 或显式代码）。

---

## 二、模式 A：自管 RBAC 规范 (`LocalRbac`)

1. **初始种子管理员 (Bootstrap Admin)**：
   - 数据库初始化时，若用户表无任何管理员，自动创建默认初始管理员账号（如 `admin`），密码通过配置文件、环境变量或初次启动控制台随机输出。
   - 内置管理员拥有系统角色 `admin`（Permissions 包含 `*`），具备后台配置、用户授权、通道管理等全部底层特权。
2. **常规用户生命周期**：
   - 支持后台管理员创建或自注册（依据业务选型开闭）。
   - 用户绑定单一或多角色，每个角色绑定明确的权限点代码数组（如 `["system:config", "users:read", "intel:view"]`）。
   - 登录发放安全 Bearer Token 或安全 Cookie，携带过期时间。

---

## 三、模式 B：Authentik OAuth / OIDC 规范 (`AuthentikOauth`)

1. **禁止本地 admin 登录**：
   - 屏蔽本地账密登录通道，所有用户必须经由企业自建的 Authentik IdP 统一认证。
2. **首登管理员自动认领 (First-User Bootstrap)**：
   - 当系统处于 Authentik 模式且**尚无任何已激活的 Authentik 管理员**时：
   - **第一个**成功完成 Authentik 授权登录的用户，系统自动将其分配为 `admin` 角色（首登立为管理员）。
3. **角色与组同步机制**：
   - **方案 1（Authentik 组同步，推荐）**：系统读取 OIDC UserInfo / Token 中的 `groups` 声明。如果 Authentik 中的 Group 名称（如 `leapmotor-admins` 或 `admin`）与本地系统的 `AppRole.Code` 匹配，自动为用户刷新赋予该角色。
   - **方案 2（本地自管）**：Authentik 仅负责证实用户身份（AuthN），用户登录后在业务系统后台的角色分配页面由管理员指派业务角色（AuthZ）。

---

## 四、领域模型标准 (Domain Entities)

以 FreeSql 为例，业务后端统一采用如下四个核心模型结构：

### 1. 用户表 `AppUser`
```csharp
[Table(Name = "app_users")]
public class AppUser
{
    [Column(Name = "id", IsPrimary = true, IsIdentity = true)]
    public int Id { get; set; }

    [Column(Name = "username", StringLength = 64)]
    public string Username { get; set; } = string.Empty;

    [Column(Name = "display_name", StringLength = 64)]
    public string? DisplayName { get; set; }

    [Column(Name = "email", StringLength = 128)]
    public string? Email { get; set; }

    // 仅 Local 模式生效；Authentik 模式下为 null
    [Column(Name = "password_hash", StringLength = 256)]
    public string? PasswordHash { get; set; }

    // 认证来源: "local" | "authentik"
    [Column(Name = "auth_source", StringLength = 32)]
    public string AuthSource { get; set; } = "local";

    // Authentik 的 sub (OpenID Connect Subject ID)
    [Column(Name = "oauth_sub", StringLength = 128)]
    public string? OAuthSub { get; set; }

    [Column(Name = "role_id")]
    public int RoleId { get; set; }

    [Column(Name = "is_active")]
    public bool IsActive { get; set; } = true;

    [Column(Name = "token", StringLength = 128)]
    public string? Token { get; set; }

    [Column(Name = "token_expiry")]
    public long TokenExpiry { get; set; }

    [Column(Name = "last_login_time")]
    public long LastLoginTime { get; set; }

    [Column(Name = "created_time")]
    public long CreatedTime { get; set; }
}
```

### 2. 角色表 `AppRole`
```csharp
[Table(Name = "app_roles")]
public class AppRole
{
    [Column(Name = "id", IsPrimary = true, IsIdentity = true)]
    public int Id { get; set; }

    [Column(Name = "code", StringLength = 64)]
    public string Code { get; set; } = "user"; // "admin", "operator", "viewer"

    [Column(Name = "name", StringLength = 64)]
    public string Name { get; set; } = "普通用户";

    [Column(Name = "is_system")]
    public bool IsSystem { get; set; } = false; // 系统内置角色不可删除

    // JSON 序列化的权限代码清单
    [Column(Name = "permissions_json", StringLength = 2048)]
    public string PermissionsJson { get; set; } = "[]";
}
```

### 3. 权限点常量定义 `PermissionCodes`
```csharp
public static class PermissionCodes
{
    public const string All = "*";                       // 顶层超管统配
    public const string SystemConfig = "system:config";   // 基础设置读写
    public const string UserManage = "user:manage";       // 账号与角色管理
    public const string BusinessManage = "business:manage"; // 业务模块操作
    public const string BusinessView = "business:view";   // 业务数据只读
}
```

---

## 五、前后端契约规范 (REST API)

### 1. 查询当前系统认证策略
`GET /api/auth/config`
- 前端用于判断展示账号密码表单还是直接渲染“使用 Authentik 单点登录”按钮。

```json
{
  "ok": true,
  "data": {
    "auth_mode": "AuthentikOauth", // 或 "LocalRbac"
    "allow_password_login": false,
    "oauth_login_url": "https://auth.example.com/application/o/authorize?client_id=...&response_type=code..."
  }
}
```

### 2. 密码登录（仅 LocalRbac）
`POST /api/auth/login`
- 当 `Auth:Mode == "AuthentikOauth"` 时：返回 `403 Forbidden` (`{"ok":false,"error":"当前系统已接入企业单点登录，密码登录通道已关闭"}`)。
- 当模式匹配且账号密码正确：发放会话凭证。

### 3. Authentik 回调换票
`POST /api/auth/oauth/authentik/callback`
- Request: `{"code": "...", "state": "..."}`
- 后端使用 `code` 请求 Authentik Token Endpoint，换取 `access_token` 并请求 UserInfo Endpoint。
- 提取 `sub`、`preferred_username`、`email`、`groups`。
- 执行**首登提权**或**组映射**逻辑，更新最后登录时间并返回前端 Token 与用户信息。

```json
{
  "ok": true,
  "data": {
    "token": "a1b2c3d4...",
    "username": "zhangsan",
    "display_name": "张三",
    "role": "admin",
    "permissions": ["*"],
    "expire_at": 1793635200
  }
}
```

### 4. 获取当前用户身份与权限
`GET /api/auth/me`
- 返回当前登录用户的资料、所属角色及完整权限点数组，供前端 RMDL 页面框架与导航菜单渲染。

---

## 六、后端权限门禁拦截器示例 (.NET Minimal API)

```csharp
public static RouteHandlerBuilder RequirePermission(this RouteHandlerBuilder builder, string permissionCode)
{
    return builder.AddEndpointFilter(async (ctx, next) =>
    {
        var fsql = ctx.HttpContext.RequestServices.GetRequiredService<IFreeSql>();
        var user = GetCurrentUser(ctx.HttpContext, fsql);
        if (user == null || !user.IsActive)
        {
            return Results.Unauthorized();
        }

        var role = fsql.Select<AppRole>().Where(r => r.Id == user.RoleId).First();
        var perms = JsonSerializer.Deserialize<List<string>>(role?.PermissionsJson ?? "[]") ?? new();

        // 超级管理员通配符或指定权限点命中
        if (!perms.Contains("*") && !perms.Contains(permissionCode))
        {
            return Results.Json(new { ok = false, error = "权限不足，禁止操作" }, statusCode: 403);
        }

        return await next(ctx);
    });
}
```

---

## 七、实施验收清单

- [ ] `Auth:Mode` 为 `AuthentikOauth` 时，本地 `admin` 密码登录被 100% 阻断（403）。
- [ ] 第一个通过 Authentik 授权进来的账号获得系统 `admin` 角色。
- [ ] Authentik 传递 `groups` 时，能正确匹配并映射到本地 `AppRole`。
- [ ] 受保护的后端 API 经由 `RequirePermission` 或中间件拦截未授权请求，不依赖前端界面防御。
- [ ] 前端在进入应用后调用 `/api/auth/config` 动态适配登录入口。
