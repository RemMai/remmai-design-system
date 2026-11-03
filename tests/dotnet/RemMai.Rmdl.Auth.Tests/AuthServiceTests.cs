using FreeSql;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RemMai.Rmdl.Auth.Configuration;
using RemMai.Rmdl.Auth.Domain;
using RemMai.Rmdl.Auth.Infrastructure;
using RemMai.Rmdl.Auth.Middleware;
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
            Authority = "https://auth.example.com",
            ApplicationSlug = "sample-app",
            ClientId = "test-client-id",
            ClientSecret = "secret",
            RedirectUri = "https://console.example.com/auth/callback"
        };

        Assert.Equal("https://auth.example.com/application/o/authorize/", options.GetAuthorizeEndpoint());
        Assert.Equal("https://auth.example.com/application/o/token/", options.GetTokenEndpoint());
        Assert.Equal("https://auth.example.com/application/o/userinfo/", options.GetUserInfoEndpoint());
        Assert.Equal("https://auth.example.com/application/o/sample-app/", options.GetIssuer());
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
                Authority = "https://auth.example.com",
                ApplicationSlug = "sample-app",
                ClientId = "test-client",
                ClientSecret = "test-secret",
                RedirectUri = "https://console.example.com/auth/callback"
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

    [Fact]
    public async Task SpaGuardMiddleware_UnauthenticatedPageAccess_RedirectsToLogin()
    {
        var authOptions = new RmdlAuthOptions { Mode = "LocalRbac" };
        var service = new RmdlAuthService(
            _fsql,
            Options.Create(authOptions),
            new MockHttpClientFactory(),
            NullLogger<RmdlAuthService>.Instance
        );

        var guardOptions = new RmdlSpaGuardOptions
        {
            LoginPagePath = "/login"
        };

        var middleware = new RemMai.Rmdl.Auth.Middleware.RmdlSpaAuthGuardMiddleware(
            next: (ctx) => Task.CompletedTask,
            Options.Create(guardOptions)
        );

        // 1. Visit /dashboard without token
        var context = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        context.Request.Path = "/dashboard";
        context.Request.Method = "GET";
        context.Request.Headers.Accept = "text/html";

        await middleware.InvokeAsync(context, service, Options.Create(authOptions));

        Assert.Equal(302, context.Response.StatusCode);
        Assert.Equal("/login?redirect=%2Fdashboard", context.Response.Headers.Location.ToString());

        // 2. Visit /api/tasks without token
        var apiContext = new Microsoft.AspNetCore.Http.DefaultHttpContext();
        apiContext.Request.Path = "/api/tasks";
        apiContext.Request.Method = "GET";

        await middleware.InvokeAsync(apiContext, service, Options.Create(authOptions));
        Assert.Equal(401, apiContext.Response.StatusCode);
    }

    private class MockHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new HttpClient();
    }
}
