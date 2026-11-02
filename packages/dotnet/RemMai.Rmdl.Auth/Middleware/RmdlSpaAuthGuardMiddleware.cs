using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using RemMai.Rmdl.Auth.Configuration;
using RemMai.Rmdl.Auth.Filters;
using RemMai.Rmdl.Auth.Services;

namespace RemMai.Rmdl.Auth.Middleware;

public class RmdlSpaGuardOptions
{
    /// <summary>
    /// 登录页面路径，默认 /login
    /// </summary>
    public string LoginPagePath { get; set; } = "/login";

    /// <summary>
    /// 白名单路径前缀列表（不校验登录，直接放行）
    /// </summary>
    public List<string> ExcludedPrefixes { get; set; } = new()
    {
        "/login",
        "/api/auth",
        "/auth/callback",
        "/assets",
        "/static",
        "/favicon.ico"
    };

    /// <summary>
    /// 在 Authentik 模式下，未登录是否直接 302 跳转到 Authentik IdP 认证页（为 false 时跳到 /login）
    /// </summary>
    public bool DirectRedirectToAuthentikInSsoMode { get; set; } = false;
}

public class RmdlSpaAuthGuardMiddleware
{
    private readonly RequestDelegate _next;
    private readonly RmdlSpaGuardOptions _guardOptions;

    public RmdlSpaAuthGuardMiddleware(RequestDelegate next, IOptions<RmdlSpaGuardOptions> guardOptions)
    {
        _next = next;
        _guardOptions = guardOptions.Value;
    }

    public async Task InvokeAsync(HttpContext context, IRmdlAuthService authService, IOptions<RmdlAuthOptions> authOptions)
    {
        var path = context.Request.Path.Value ?? "/";

        // 1. 如果属于白名单路径，直接放行
        foreach (var prefix in _guardOptions.ExcludedPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                await _next(context);
                return;
            }
        }

        // 2. 如果属于静态资源扩展名（.js, .css, .png, .svg, .woff 等），直接放行
        var ext = Path.GetExtension(path);
        if (!string.IsNullOrEmpty(ext) && !ext.Equals(".html", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // 3. 判断是否是浏览器页面导航请求（Accept: text/html 或 GET /xxx）
        var isHtmlRequest = context.Request.Headers.Accept.ToString().Contains("text/html")
                            || context.Request.Method.Equals("GET", StringComparison.OrdinalIgnoreCase);

        // 4. 提取凭据并核验登录态
        var token = RmdlAuthFilters.ExtractToken(context);
        var isAuthenticated = false;

        if (!string.IsNullOrEmpty(token))
        {
            var (isAuth, user, _, _) = await authService.GetCurrentUserAsync(token);
            isAuthenticated = isAuth && user != null && user.IsActive;
        }

        // 5. 如果未登录
        if (!isAuthenticated)
        {
            // 如果是 API 请求，返回 401 JSON
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    ok = false,
                    error = "未登录或登录态已失效，禁止访问受保护资源",
                    redirect_url = _guardOptions.LoginPagePath
                });
                return;
            }

            // 如果是页面导航请求，坚决拦截，302 重定向到登录页或 Authentik，禁止输出内部页面 DOM
            if (isHtmlRequest)
            {
                var returnUrl = Uri.EscapeDataString(path + context.Request.QueryString);
                var options = authOptions.Value;

                if (options.IsAuthentikMode && _guardOptions.DirectRedirectToAuthentikInSsoMode)
                {
                    var oauthUrl = authService.GetAuthentikAuthorizeUrl();
                    context.Response.Redirect(oauthUrl);
                    return;
                }

                var targetLoginUrl = $"{_guardOptions.LoginPagePath}?redirect={returnUrl}";
                context.Response.Redirect(targetLoginUrl);
                return;
            }
        }

        await _next(context);
    }
}
