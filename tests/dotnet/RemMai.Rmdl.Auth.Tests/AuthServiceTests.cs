using FreeSql;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RemMai.Rmdl.Auth.Configuration;
using RemMai.Rmdl.Auth.Domain;
using RemMai.Rmdl.Auth.Infrastructure;
using RemMai.Rmdl.Auth.Models;
using RemMai.Rmdl.Auth.Services;
using Xunit;

namespace RemMai.Rmdl.Auth.Tests;

public class AuthServiceTests : IDisposable
{
    private readonly IFreeSql _fsql;
    private readonly string _dbPath;

    public AuthServiceTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"rmdl_test_{Guid.NewGuid():N}.db");
        _fsql = new FreeSqlBuilder()
            .UseConnectionString(DataType.Sqlite, $"Data Source={_dbPath}")
            .UseAutoSyncStructure(true)
            .Build();
    }

    public void Dispose()
    {
        _fsql.Dispose();
        if (File.Exists(_dbPath))
        {
            try { File.Delete(_dbPath); } catch { }
        }
    }

    [Fact]
    public void PasswordHelper_HashAndVerify_WorksCorrectly()
    {
        var password = "SuperSecretPassword123!";
        var hash = PasswordHelper.HashPassword(password);

        Assert.NotEmpty(hash);
        Assert.StartsWith("pbkdf2:100000:", hash);

        Assert.True(PasswordHelper.VerifyPassword(password, hash));
        Assert.False(PasswordHelper.VerifyPassword("WrongPassword", hash));
    }

    [Fact]
    public void AuthentikOptions_EndpointsGeneration_MatchesProviderSpecification()
    {
        var options = new AuthentikOptions
        {
            Authority = "https://oauth.20000114.xyz",
            ApplicationSlug = "shenling-spider",
            ClientId = "haB7DH33IGKPEu12a0nUhwyuYEHBcyAVZvjbniuC",
            ClientSecret = "secret",
            RedirectUri = "https://lpnews.20000112.xyz/auth/callback"
        };

        Assert.Equal("https://oauth.20000114.xyz/application/o/authorize/", options.GetAuthorizeEndpoint());
        Assert.Equal("https://oauth.20000114.xyz/application/o/token/", options.GetTokenEndpoint());
        Assert.Equal("https://oauth.20000114.xyz/application/o/userinfo/", options.GetUserInfoEndpoint());
        Assert.Equal("https://oauth.20000114.xyz/application/o/shenling-spider/", options.GetIssuer());
    }

    [Fact]
    public async Task LocalMode_InitializesSeedAdmin_AndAllowsLogin()
    {
        var authOptions = new RmdlAuthOptions
        {
            Mode = "LocalRbac",
            AdminUsername = "admin",
            AdminDefaultPassword = "TestPassword888!"
        };

        var httpFactory = new MockHttpClientFactory();
        var service = new RmdlAuthService(
            _fsql,
            Options.Create(authOptions),
            httpFactory,
            NullLogger<RmdlAuthService>.Instance
        );

        // 1. Initial Login
        var res = await service.LoginAsync(new RmdlLoginRequest("admin", "TestPassword888!"));
        Assert.True(res.Ok);
        Assert.NotEmpty(res.Token!);
        Assert.Equal("admin", res.Role);
        Assert.Contains(RmdlPermissionCodes.All, res.Permissions!);

        // 2. Query Current User with Token
        var (isAuth, user, role, perms) = await service.GetCurrentUserAsync(res.Token!);
        Assert.True(isAuth);
        Assert.NotNull(user);
        Assert.Equal("admin", user.Username);
        Assert.Equal("admin", role?.Code);
        Assert.Contains(RmdlPermissionCodes.All, perms);

        // 3. Invalid password
        var failRes = await service.LoginAsync(new RmdlLoginRequest("admin", "WrongPass"));
        Assert.False(failRes.Ok);
        Assert.Equal("账号或密码错误", failRes.Error);
    }

    [Fact]
    public async Task AuthentikMode_BlocksPasswordLogin_WithForbidden()
    {
        var authOptions = new RmdlAuthOptions
        {
            Mode = "AuthentikOauth",
            Authentik = new AuthentikOptions
            {
                Authority = "https://oauth.20000114.xyz",
                ApplicationSlug = "shenling-spider",
                ClientId = "test-client",
                ClientSecret = "test-secret",
                RedirectUri = "https://lpnews.20000112.xyz/auth/callback"
            }
        };

        var httpFactory = new MockHttpClientFactory();
        var service = new RmdlAuthService(
            _fsql,
            Options.Create(authOptions),
            httpFactory,
            NullLogger<RmdlAuthService>.Instance
        );

        var res = await service.LoginAsync(new RmdlLoginRequest("admin", "anypassword"));
        Assert.False(res.Ok);
        Assert.Contains("单点登录", res.Error);
    }

    private class MockHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new HttpClient();
    }
}
