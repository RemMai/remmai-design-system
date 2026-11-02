using System.Text.Json.Serialization;

namespace RemMai.Rmdl.Auth.Models;

public record RmdlAuthConfigResponse(
    [property: JsonPropertyName("auth_mode")] string AuthMode,
    [property: JsonPropertyName("allow_password_login")] bool AllowPasswordLogin,
    [property: JsonPropertyName("oauth_login_url")] string? OAuthLoginUrl,
    [property: JsonPropertyName("client_id")] string? ClientId
);

public record RmdlLoginRequest(
    [property: JsonPropertyName("username")] string Username,
    [property: JsonPropertyName("password")] string Password
);

public record RmdlAuthCallbackRequest(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("state")] string? State,
    [property: JsonPropertyName("redirect_uri")] string? RedirectUri
);

public record RmdlAuthResponse(
    [property: JsonPropertyName("ok")] bool Ok,
    [property: JsonPropertyName("token")] string? Token = null,
    [property: JsonPropertyName("username")] string? Username = null,
    [property: JsonPropertyName("display_name")] string? DisplayName = null,
    [property: JsonPropertyName("role")] string? Role = null,
    [property: JsonPropertyName("permissions")] List<string>? Permissions = null,
    [property: JsonPropertyName("expire_at")] long ExpireAt = 0,
    [property: JsonPropertyName("error")] string? Error = null
);

public class AuthentikTokenResponse
{
    [JsonPropertyName("access_token")]
    public string? AccessToken { get; set; }

    [JsonPropertyName("token_type")]
    public string? TokenType { get; set; }

    [JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; set; }

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }

    [JsonPropertyName("id_token")]
    public string? IdToken { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("error_description")]
    public string? ErrorDescription { get; set; }
}

public class AuthentikUserInfoResponse
{
    [JsonPropertyName("sub")]
    public string? Sub { get; set; }

    [JsonPropertyName("preferred_username")]
    public string? PreferredUsername { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("groups")]
    public List<string>? Groups { get; set; }
}
