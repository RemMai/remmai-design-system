using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using RemMai.Rmdl.Auth.Domain;
using RemMai.Rmdl.Auth.Services;

namespace RemMai.Rmdl.Auth.Filters;

public static class RmdlAuthFilters
{
    public const string HttpContextUserKey = "Rmdl_CurrentUser";
    public const string HttpContextRoleKey = "Rmdl_CurrentRole";
    public const string HttpContextPermissionsKey = "Rmdl_CurrentPermissions";

    public static string? ExtractToken(HttpContext context)
    {
        // 1. Authorization: Bearer <token>
        var authHeader = context.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authHeader.Substring(7).Trim();
        }

        // 2. X-Auth-Token
        if (context.Request.Headers.TryGetValue("X-Auth-Token", out var customHeader))
        {
            var val = customHeader.ToString();
            if (!string.IsNullOrEmpty(val)) return val.Trim();
        }

        // 3. Cookie rmdl_token
        if (context.Request.Cookies.TryGetValue("rmdl_token", out var cookieToken))
        {
            if (!string.IsNullOrEmpty(cookieToken)) return cookieToken.Trim();
        }

        return null;
    }

    public static RmdlUser? GetRmdlUser(this HttpContext context)
    {
        if (context.Items.TryGetValue(HttpContextUserKey, out var userObj) && userObj is RmdlUser user)
        {
            return user;
        }
        return null;
    }

    public static List<string> GetRmdlPermissions(this HttpContext context)
    {
        if (context.Items.TryGetValue(HttpContextPermissionsKey, out var permsObj) && permsObj is List<string> perms)
        {
            return perms;
        }
        return new List<string>();
    }

    /// <summary>
    /// 要求用户必须已登录
    /// </summary>
    public static RouteHandlerBuilder RequireRmdlAuthenticated(this RouteHandlerBuilder builder)
    {
        return builder.AddEndpointFilter(async (ctx, next) =>
        {
            var httpContext = ctx.HttpContext;
            var token = ExtractToken(httpContext);
            if (string.IsNullOrEmpty(token))
            {
                return Results.Json(new { ok = false, error = "未登录或凭据已失效" }, statusCode: 401);
            }

            var authService = httpContext.RequestServices.GetRequiredService<IRmdlAuthService>();
            var (isAuth, user, role, perms) = await authService.GetCurrentUserAsync(token);

            if (!isAuth || user == null)
            {
                return Results.Json(new { ok = false, error = "登录会话已过期，请重新登录" }, statusCode: 401);
            }

            httpContext.Items[HttpContextUserKey] = user;
            httpContext.Items[HttpContextRoleKey] = role;
            httpContext.Items[HttpContextPermissionsKey] = perms;

            return await next(ctx);
        });
    }

    /// <summary>
    /// 要求用户具备指定角色
    /// </summary>
    public static RouteHandlerBuilder RequireRmdlRole(this RouteHandlerBuilder builder, string roleCode)
    {
        return builder.RequireRmdlAuthenticated().AddEndpointFilter(async (ctx, next) =>
        {
            var httpContext = ctx.HttpContext;
            var role = httpContext.Items[HttpContextRoleKey] as RmdlRole;

            if (role == null || (!string.Equals(role.Code, "admin", StringComparison.OrdinalIgnoreCase) &&
                                 !string.Equals(role.Code, roleCode, StringComparison.OrdinalIgnoreCase)))
            {
                return Results.Json(new { ok = false, error = "权限不足，角色不匹配" }, statusCode: 403);
            }

            return await next(ctx);
        });
    }

    /// <summary>
    /// 要求用户具备指定权限点（或超级管理员通配符 "*"）
    /// </summary>
    public static RouteHandlerBuilder RequireRmdlPermission(this RouteHandlerBuilder builder, string permissionCode)
    {
        return builder.RequireRmdlAuthenticated().AddEndpointFilter(async (ctx, next) =>
        {
            var httpContext = ctx.HttpContext;
            var perms = httpContext.GetRmdlPermissions();

            if (!perms.Contains(RmdlPermissionCodes.All) && !perms.Contains(permissionCode))
            {
                return Results.Json(new { ok = false, error = $"权限不足，缺少权限点: {permissionCode}" }, statusCode: 403);
            }

            return await next(ctx);
        });
    }
}
