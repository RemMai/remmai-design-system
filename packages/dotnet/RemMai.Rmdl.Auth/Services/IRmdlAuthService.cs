using RemMai.Rmdl.Auth.Domain;
using RemMai.Rmdl.Auth.Models;

namespace RemMai.Rmdl.Auth.Services;

public interface IRmdlAuthService
{
    Task EnsureInitializedAsync();
    RmdlAuthConfigResponse GetConfig();
    string GetAuthentikAuthorizeUrl(string? redirectUriOverride = null, string? state = null);
    Task<RmdlAuthResponse> LoginAsync(RmdlLoginRequest request);
    Task<RmdlAuthResponse> AuthentikCallbackAsync(RmdlAuthCallbackRequest request);
    Task<(bool IsAuthenticated, RmdlUser? User, RmdlRole? Role, List<string> Permissions)> GetCurrentUserAsync(string token);
    Task<bool> LogoutAsync(string token);
}
