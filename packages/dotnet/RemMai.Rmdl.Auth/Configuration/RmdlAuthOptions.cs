namespace RemMai.Rmdl.Auth.Configuration;

public class RmdlAuthOptions
{
    public const string SectionName = "Auth";

    /// <summary>
    /// 认证模式："AuthentikOauth" 或 "LocalRbac"
    /// </summary>
    public string Mode { get; set; } = "AuthentikOauth";

    /// <summary>
    /// 会话 Token 有效期天数，默认 7 天
    /// </summary>
    public int TokenExpiryDays { get; set; } = 7;

    /// <summary>
    /// 自管模式下初始管理员账号
    /// </summary>
    public string AdminUsername { get; set; } = "admin";

    /// <summary>
    /// 自管模式下初始管理员密码
    /// </summary>
    public string AdminDefaultPassword { get; set; } = "admin123";

    /// <summary>
    /// Authentik OAuth / OIDC 配置
    /// </summary>
    public AuthentikOptions Authentik { get; set; } = new();

    public bool IsAuthentikMode => string.Equals(Mode, "AuthentikOauth", StringComparison.OrdinalIgnoreCase);
    public bool IsLocalMode => string.Equals(Mode, "LocalRbac", StringComparison.OrdinalIgnoreCase);
}

public class AuthentikOptions
{
    /// <summary>
    /// Authentik 服务器根地址，例如 https://auth.example.com
    /// </summary>
    public string Authority { get; set; } = string.Empty;

    /// <summary>
    /// Authentik 中分配给应用的 Application Slug，例如 sample-app
    /// </summary>
    public string ApplicationSlug { get; set; } = string.Empty;

    /// <summary>
    /// OAuth2 Client ID
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// OAuth2 Client Secret
    /// </summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// 后端回调或前端回调地址，例如 https://console.example.com/auth/callback
    /// </summary>
    public string RedirectUri { get; set; } = string.Empty;

    /// <summary>
    /// 请求权限范围，默认 openid email profile
    /// </summary>
    public string Scopes { get; set; } = "openid email profile";

    /// <summary>
    /// 映射为系统管理员的 Authentik 组名（例如 authentik-admins 或 administrators）
    /// </summary>
    public string AdminGroup { get; set; } = "admin";

    /// <summary>
    /// 当系统尚无管理员时，第一个通过 Authentik 登录的用户自动提权为 Admin
    /// </summary>
    public bool AutoBootstrapFirstUserAsAdmin { get; set; } = true;

    /// <summary>
    /// 获取认证授权地址 (Authorize Endpoint)
    /// </summary>
    public string GetAuthorizeEndpoint()
    {
        var baseUri = Authority.TrimEnd('/');
        return $"{baseUri}/application/o/authorize/";
    }

    /// <summary>
    /// 获取换票地址 (Token Endpoint)
    /// </summary>
    public string GetTokenEndpoint()
    {
        var baseUri = Authority.TrimEnd('/');
        return $"{baseUri}/application/o/token/";
    }

    /// <summary>
    /// 获取用户信息地址 (UserInfo Endpoint)
    /// </summary>
    public string GetUserInfoEndpoint()
    {
        var baseUri = Authority.TrimEnd('/');
        return $"{baseUri}/application/o/userinfo/";
    }

    /// <summary>
    /// 获取 OIDC Issuer
    /// </summary>
    public string GetIssuer()
    {
        var baseUri = Authority.TrimEnd('/');
        if (!string.IsNullOrEmpty(ApplicationSlug))
        {
            return $"{baseUri}/application/o/{ApplicationSlug}/";
        }
        return $"{baseUri}/";
    }
}
