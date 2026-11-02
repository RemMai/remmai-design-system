using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text.Json;
using FreeSql;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RemMai.Rmdl.Auth.Configuration;
using RemMai.Rmdl.Auth.Domain;
using RemMai.Rmdl.Auth.Infrastructure;
using RemMai.Rmdl.Auth.Models;

namespace RemMai.Rmdl.Auth.Services;

public class RmdlAuthService : IRmdlAuthService
{
    private readonly IFreeSql _fsql;
    private readonly RmdlAuthOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RmdlAuthService> _logger;
    private bool _initialized;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public RmdlAuthService(
        IFreeSql fsql,
        IOptions<RmdlAuthOptions> options,
        IHttpClientFactory httpClientFactory,
        ILogger<RmdlAuthService> logger)
    {
        _fsql = fsql;
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task EnsureInitializedAsync()
    {
        if (_initialized) return;

        await _initLock.WaitAsync();
        try
        {
            if (_initialized) return;

            // 1. 同步数据表结构
            _fsql.CodeFirst.SyncStructure<RmdlRole>();
            _fsql.CodeFirst.SyncStructure<RmdlUser>();

            // 2. 初始化核心系统角色
            var adminRole = await _fsql.Select<RmdlRole>().Where(r => r.Code == "admin").FirstAsync();
            if (adminRole == null)
            {
                adminRole = new RmdlRole
                {
                    Code = "admin",
                    Name = "超级管理员",
                    IsSystem = true,
                    PermissionsJson = JsonSerializer.Serialize(new List<string> { RmdlPermissionCodes.All })
                };
                adminRole.Id = (int)await _fsql.Insert(adminRole).ExecuteIdentityAsync();
            }

            var userRole = await _fsql.Select<RmdlRole>().Where(r => r.Code == "user").FirstAsync();
            if (userRole == null)
            {
                userRole = new RmdlRole
                {
                    Code = "user",
                    Name = "普通用户",
                    IsSystem = true,
                    PermissionsJson = JsonSerializer.Serialize(new List<string> { RmdlPermissionCodes.BusinessView })
                };
                userRole.Id = (int)await _fsql.Insert(userRole).ExecuteIdentityAsync();
            }

            // 3. 自管模式种子用户
            if (_options.IsLocalMode)
            {
                var existingUsers = await _fsql.Select<RmdlUser>().CountAsync();
                if (existingUsers == 0)
                {
                    var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    var defaultAdmin = new RmdlUser
                    {
                        Username = _options.AdminUsername,
                        DisplayName = "内置管理员",
                        PasswordHash = PasswordHelper.HashPassword(_options.AdminDefaultPassword),
                        AuthSource = "local",
                        RoleId = adminRole.Id,
                        IsActive = true,
                        CreatedTime = now
                    };
                    await _fsql.Insert(defaultAdmin).ExecuteAffrowsAsync();
                    _logger.LogInformation("RMDL Auth: 已在 LocalRbac 模式下初始化默认管理员: {Username}", _options.AdminUsername);
                }
            }

            _initialized = true;
        }
        finally
        {
            _initLock.Release();
        }
    }

    public RmdlAuthConfigResponse GetConfig()
    {
        var authMode = _options.Mode;
        var allowPasswordLogin = _options.IsLocalMode;
        string? oauthLoginUrl = null;

        if (_options.IsAuthentikMode)
        {
            oauthLoginUrl = GetAuthentikAuthorizeUrl();
        }

        return new RmdlAuthConfigResponse(
            AuthMode: authMode,
            AllowPasswordLogin: allowPasswordLogin,
            OAuthLoginUrl: oauthLoginUrl,
            ClientId: _options.Authentik.ClientId
        );
    }

    public string GetAuthentikAuthorizeUrl(string? redirectUriOverride = null, string? state = null)
    {
        var auth = _options.Authentik;
        var endpoint = auth.GetAuthorizeEndpoint();
        var redirectUri = redirectUriOverride ?? auth.RedirectUri;

        var stateParam = string.IsNullOrEmpty(state)
            ? Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant()
            : state;

        var url = $"{endpoint}?client_id={Uri.EscapeDataString(auth.ClientId)}" +
                  $"&response_type=code" +
                  $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
                  $"&scope={Uri.EscapeDataString(auth.Scopes)}" +
                  $"&state={Uri.EscapeDataString(stateParam)}";

        return url;
    }

    public async Task<RmdlAuthResponse> LoginAsync(RmdlLoginRequest request)
    {
        await EnsureInitializedAsync();

        if (_options.IsAuthentikMode)
        {
            _logger.LogWarning("拦截密码登录尝试：系统已启用 Authentik 单点登录模式");
            return new RmdlAuthResponse(
                Ok: false,
                Error: "当前系统已接入企业单点登录，密码登录通道已关闭"
            );
        }

        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return new RmdlAuthResponse(Ok: false, Error: "账号或密码不能为空");
        }

        var user = await _fsql.Select<RmdlUser>()
            .Where(u => u.Username == request.Username)
            .FirstAsync();

        if (user == null || !user.IsActive || !PasswordHelper.VerifyPassword(request.Password, user.PasswordHash))
        {
            return new RmdlAuthResponse(Ok: false, Error: "账号或密码错误");
        }

        return await GenerateSessionAndRespondAsync(user);
    }

    public async Task<RmdlAuthResponse> AuthentikCallbackAsync(RmdlAuthCallbackRequest request)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return new RmdlAuthResponse(Ok: false, Error: "授权码 (code) 不能为空");
        }

        var auth = _options.Authentik;
        var redirectUri = request.RedirectUri ?? auth.RedirectUri;

        // 1. 请求 Token Endpoint 换票
        var client = _httpClientFactory.CreateClient("RmdlAuthentik");
        var tokenEndpoint = auth.GetTokenEndpoint();

        var tokenParams = new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "client_id", auth.ClientId },
            { "client_secret", auth.ClientSecret },
            { "code", request.Code },
            { "redirect_uri", redirectUri }
        };

        AuthentikTokenResponse? tokenData;
        try
        {
            using var tokenReq = new HttpRequestMessage(HttpMethod.Post, tokenEndpoint)
            {
                Content = new FormUrlEncodedContent(tokenParams)
            };
            tokenReq.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var tokenRes = await client.SendAsync(tokenReq);
            var tokenJson = await tokenRes.Content.ReadAsStringAsync();

            if (!tokenRes.IsSuccessStatusCode)
            {
                _logger.LogError("Authentik 换票失败: {StatusCode} {Body}", tokenRes.StatusCode, tokenJson);
                return new RmdlAuthResponse(Ok: false, Error: $"Authentik 换票失败: {tokenRes.StatusCode}");
            }

            tokenData = JsonSerializer.Deserialize<AuthentikTokenResponse>(tokenJson);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "请求 Authentik Token Endpoint 发生网络异常");
            return new RmdlAuthResponse(Ok: false, Error: "无法连接到 Authentik 认证服务器");
        }

        if (string.IsNullOrEmpty(tokenData?.AccessToken))
        {
            return new RmdlAuthResponse(Ok: false, Error: tokenData?.ErrorDescription ?? "未能获取有效的 AccessToken");
        }

        // 2. 请求 UserInfo Endpoint 获取用户档案
        AuthentikUserInfoResponse? userInfo;
        try
        {
            using var userReq = new HttpRequestMessage(HttpMethod.Get, auth.GetUserInfoEndpoint());
            userReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenData.AccessToken);
            userReq.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var userRes = await client.SendAsync(userReq);
            var userJson = await userRes.Content.ReadAsStringAsync();

            if (!userRes.IsSuccessStatusCode)
            {
                _logger.LogError("获取 Authentik UserInfo 失败: {StatusCode} {Body}", userRes.StatusCode, userJson);
                return new RmdlAuthResponse(Ok: false, Error: $"获取用户信息失败: {userRes.StatusCode}");
            }

            userInfo = JsonSerializer.Deserialize<AuthentikUserInfoResponse>(userJson);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "请求 Authentik UserInfo Endpoint 发生网络异常");
            return new RmdlAuthResponse(Ok: false, Error: "获取 Authentik 用户信息超时");
        }

        if (userInfo == null || string.IsNullOrEmpty(userInfo.Sub))
        {
            return new RmdlAuthResponse(Ok: false, Error: "Authentik 用户标识 (sub) 为空");
        }

        // 3. 用户匹配、自举与组映射
        var user = await _fsql.Select<RmdlUser>()
            .Where(u => u.OAuthSub == userInfo.Sub || (u.Username == userInfo.PreferredUsername && u.AuthSource == "authentik"))
            .FirstAsync();

        var adminRole = await _fsql.Select<RmdlRole>().Where(r => r.Code == "admin").FirstAsync();
        var defaultUserRole = await _fsql.Select<RmdlRole>().Where(r => r.Code == "user").FirstAsync();

        // 判定角色
        int targetRoleId = defaultUserRole?.Id ?? 1;

        // 判定首位管理员提权
        var existingAdminsCount = adminRole != null
            ? await _fsql.Select<RmdlUser>().Where(u => u.RoleId == adminRole.Id).CountAsync()
            : 0;

        bool shouldPromoteAdmin = false;
        if (auth.AutoBootstrapFirstUserAsAdmin && existingAdminsCount == 0)
        {
            shouldPromoteAdmin = true;
            _logger.LogInformation("首登提权：Authentik 用户 {Username} ({Sub}) 成为首位管理员", userInfo.PreferredUsername, userInfo.Sub);
        }
        else if (userInfo.Groups != null && !string.IsNullOrEmpty(auth.AdminGroup) && userInfo.Groups.Contains(auth.AdminGroup))
        {
            shouldPromoteAdmin = true;
        }

        if (shouldPromoteAdmin && adminRole != null)
        {
            targetRoleId = adminRole.Id;
        }
        else if (userInfo.Groups != null)
        {
            // 组映射匹配
            var roles = await _fsql.Select<RmdlRole>().ToListAsync();
            var matchedRole = roles.FirstOrDefault(r => userInfo.Groups.Contains(r.Code));
            if (matchedRole != null)
            {
                targetRoleId = matchedRole.Id;
            }
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (user == null)
        {
            user = new RmdlUser
            {
                Username = userInfo.PreferredUsername ?? userInfo.Sub,
                DisplayName = userInfo.Name ?? userInfo.PreferredUsername,
                Email = userInfo.Email,
                AuthSource = "authentik",
                OAuthSub = userInfo.Sub,
                RoleId = targetRoleId,
                IsActive = true,
                CreatedTime = now
            };
            user.Id = (int)await _fsql.Insert(user).ExecuteIdentityAsync();
        }
        else
        {
            user.OAuthSub = userInfo.Sub;
            if (!string.IsNullOrEmpty(userInfo.Name)) user.DisplayName = userInfo.Name;
            if (!string.IsNullOrEmpty(userInfo.Email)) user.Email = userInfo.Email;
            if (shouldPromoteAdmin && adminRole != null) user.RoleId = adminRole.Id;
        }

        return await GenerateSessionAndRespondAsync(user);
    }

    public async Task<(bool IsAuthenticated, RmdlUser? User, RmdlRole? Role, List<string> Permissions)> GetCurrentUserAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return (false, null, null, new List<string>());

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var user = await _fsql.Select<RmdlUser>()
            .Where(u => u.Token == token && u.TokenExpiry > now && u.IsActive)
            .FirstAsync();

        if (user == null)
            return (false, null, null, new List<string>());

        var role = await _fsql.Select<RmdlRole>().Where(r => r.Id == user.RoleId).FirstAsync();
        var perms = new List<string>();
        if (role != null && !string.IsNullOrEmpty(role.PermissionsJson))
        {
            perms = JsonSerializer.Deserialize<List<string>>(role.PermissionsJson) ?? new List<string>();
        }

        return (true, user, role, perms);
    }

    public async Task<bool> LogoutAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return true;

        var rows = await _fsql.Update<RmdlUser>()
            .Set(u => u.Token, null)
            .Set(u => u.TokenExpiry, 0)
            .Where(u => u.Token == token)
            .ExecuteAffrowsAsync();

        return rows > 0;
    }

    private async Task<RmdlAuthResponse> GenerateSessionAndRespondAsync(RmdlUser user)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var expireAt = DateTimeOffset.UtcNow.AddDays(_options.TokenExpiryDays).ToUnixTimeSeconds();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        user.Token = token;
        user.TokenExpiry = expireAt;
        user.LastLoginTime = now;

        await _fsql.Update<RmdlUser>()
            .Set(u => u.Token, token)
            .Set(u => u.TokenExpiry, expireAt)
            .Set(u => u.LastLoginTime, now)
            .Set(u => u.OAuthSub, user.OAuthSub)
            .Set(u => u.DisplayName, user.DisplayName)
            .Set(u => u.Email, user.Email)
            .Set(u => u.RoleId, user.RoleId)
            .Where(u => u.Id == user.Id)
            .ExecuteAffrowsAsync();

        var role = await _fsql.Select<RmdlRole>().Where(r => r.Id == user.RoleId).FirstAsync();
        var perms = new List<string>();
        if (role != null && !string.IsNullOrEmpty(role.PermissionsJson))
        {
            perms = JsonSerializer.Deserialize<List<string>>(role.PermissionsJson) ?? new List<string>();
        }

        return new RmdlAuthResponse(
            Ok: true,
            Token: token,
            Username: user.Username,
            DisplayName: user.DisplayName,
            Role: role?.Code ?? "user",
            Permissions: perms,
            ExpireAt: expireAt
        );
    }
}
