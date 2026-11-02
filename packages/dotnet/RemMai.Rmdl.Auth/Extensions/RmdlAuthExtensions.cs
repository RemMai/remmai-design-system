using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RemMai.Rmdl.Auth.Configuration;
using RemMai.Rmdl.Auth.Domain;
using RemMai.Rmdl.Auth.Filters;
using RemMai.Rmdl.Auth.Middleware;
using RemMai.Rmdl.Auth.Models;
using RemMai.Rmdl.Auth.Services;

namespace RemMai.Rmdl.Auth.Extensions;

public static class RmdlAuthExtensions
{
    /// <summary>
    /// 注册 RMDL 双模认证与 Authentik 服务
    /// </summary>
    public static IServiceCollection AddRmdlAuth(
        this IServiceCollection services,
        IConfiguration configuration,
        Action<RmdlAuthOptions>? configure = null)
    {
        // 绑定配置
        var section = configuration.GetSection(RmdlAuthOptions.SectionName);
        services.Configure<RmdlAuthOptions>(section);

        if (configure != null)
        {
            services.PostConfigure(configure);
        }

        // 注册 SPA 页面访问守卫配置
        services.Configure<RmdlSpaGuardOptions>(section.GetSection("SpaGuard"));

        // 注册 HttpClient
        services.AddHttpClient("RmdlAuthentik", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        // 注册核心服务
        services.AddScoped<IRmdlAuthService, RmdlAuthService>();

        return services;
    }

    /// <summary>
    /// 启用 SPA 页面与目标路由访问守卫中间件（未登录强制 302 重定向到 /login，绝不允许无凭据进入程序后台）
    /// </summary>
    public static IApplicationBuilder UseRmdlSpaAuthGuard(
        this IApplicationBuilder app,
        Action<RmdlSpaGuardOptions>? configure = null)
    {
        if (configure != null)
        {
            var options = new RmdlSpaGuardOptions();
            configure(options);
            return app.UseMiddleware<RmdlSpaAuthGuardMiddleware>(Options.Create(options));
        }

        return app.UseMiddleware<RmdlSpaAuthGuardMiddleware>();
    }

    /// <summary>
    /// 自动映射标准的 RMDL 认证与 Authentik 回调接口
    /// </summary>
    public static IEndpointRouteBuilder MapRmdlAuthEndpoints(
        this IEndpointRouteBuilder app,
        string prefix = "/api/auth")
    {
        var group = app.MapGroup(prefix).WithTags("RMDL Auth");

        // 1. 查询当前系统的认证策略（前端据此切换展示账密表单或 Authentik 按钮）
        group.MapGet("/config", (IRmdlAuthService authService) =>
        {
            var config = authService.GetConfig();
            return Results.Ok(new { ok = true, data = config });
        })
        .WithName("GetRmdlAuthConfig")
        .WithSummary("获取系统认证策略与 SSO 登录配置");

        // 2. 本地账密登录（Authentik 模式下强制 403 阻断）
        group.MapPost("/login", async (HttpContext context, RmdlLoginRequest request, IRmdlAuthService authService) =>
        {
            var res = await authService.LoginAsync(request);
            if (!res.Ok)
            {
                if (res.Error != null && res.Error.Contains("单点登录"))
                {
                    return Results.Json(res, statusCode: 403);
                }
                return Results.Json(res, statusCode: 400);
            }

            // 成功后自动植入 HttpOnly 会话 Cookie，供 SPA 页面守卫验证
            if (!string.IsNullOrEmpty(res.Token))
            {
                context.Response.Cookies.Append("rmdl_token", res.Token, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = context.Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.FromUnixTimeSeconds(res.ExpireAt)
                });
            }

            return Results.Ok(res);
        })
        .WithName("RmdlPasswordLogin")
        .WithSummary("账号密码登录（仅 LocalRbac 模式有效）");

        // 3. 发起 Authentik 授权跳转获取登录 URL
        group.MapGet("/oauth/authentik/login", (string? redirect_uri, string? state, IRmdlAuthService authService) =>
        {
            var url = authService.GetAuthentikAuthorizeUrl(redirect_uri, state);
            return Results.Ok(new { ok = true, data = new { login_url = url } });
        })
        .WithName("GetAuthentikAuthorizeUrl")
        .WithSummary("获取 Authentik OAuth2 授权登录跳转链接");

        // 4. Authentik 回调换票
        group.MapPost("/oauth/authentik/callback", async (HttpContext context, RmdlAuthCallbackRequest request, IRmdlAuthService authService) =>
        {
            var res = await authService.AuthentikCallbackAsync(request);
            if (!res.Ok)
            {
                return Results.Json(res, statusCode: 400);
            }

            // 成功后自动植入 HttpOnly 会话 Cookie
            if (!string.IsNullOrEmpty(res.Token))
            {
                context.Response.Cookies.Append("rmdl_token", res.Token, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = context.Request.IsHttps,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.FromUnixTimeSeconds(res.ExpireAt)
                });
            }

            return Results.Ok(res);
        })
        .WithName("AuthentikCallback")
        .WithSummary("Authentik 授权码回调换票");

        // 5. 获取当前登录用户身份、角色与权限
        group.MapGet("/me", (HttpContext context) =>
        {
            var user = context.GetRmdlUser();
            var perms = context.GetRmdlPermissions();
            var role = context.Items[RmdlAuthFilters.HttpContextRoleKey] as RmdlRole;

            if (user == null)
            {
                return Results.Json(new { ok = false, error = "未登录" }, statusCode: 401);
            }

            return Results.Ok(new
            {
                ok = true,
                data = new
                {
                    id = user.Id,
                    username = user.Username,
                    display_name = user.DisplayName,
                    email = user.Email,
                    auth_source = user.AuthSource,
                    role = role?.Code ?? "user",
                    role_name = role?.Name ?? "普通用户",
                    permissions = perms,
                    created_time = user.CreatedTime,
                    last_login_time = user.LastLoginTime
                }
            });
        })
        .RequireRmdlAuthenticated()
        .WithName("GetRmdlCurrentUser")
        .WithSummary("获取当前登录用户身份信息与权限点");

        // 6. 登出
        group.MapPost("/logout", async (HttpContext context, IRmdlAuthService authService) =>
        {
            var token = RmdlAuthFilters.ExtractToken(context);
            if (!string.IsNullOrEmpty(token))
            {
                await authService.LogoutAsync(token);
            }

            // 清理 Cookie
            context.Response.Cookies.Delete("rmdl_token");

            return Results.Ok(new { ok = true, message = "已安全退出登录" });
        })
        .WithName("RmdlLogout")
        .WithSummary("安全登出并吊销会话凭据");

        return app;
    }
}
