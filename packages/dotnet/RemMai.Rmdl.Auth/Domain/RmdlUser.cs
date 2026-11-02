using FreeSql.DataAnnotations;

namespace RemMai.Rmdl.Auth.Domain;

[Table(Name = "rmdl_users")]
public class RmdlUser
{
    [Column(Name = "id", IsPrimary = true, IsIdentity = true)]
    public int Id { get; set; }

    [Column(Name = "username", StringLength = 64)]
    public string Username { get; set; } = string.Empty;

    [Column(Name = "display_name", StringLength = 64)]
    public string? DisplayName { get; set; }

    [Column(Name = "email", StringLength = 128)]
    public string? Email { get; set; }

    /// <summary>
    /// 仅 LocalRbac 模式生效；Authentik 模式下为 null
    /// </summary>
    [Column(Name = "password_hash", StringLength = 256)]
    public string? PasswordHash { get; set; }

    /// <summary>
    /// 认证来源："local" | "authentik"
    /// </summary>
    [Column(Name = "auth_source", StringLength = 32)]
    public string AuthSource { get; set; } = "local";

    /// <summary>
    /// Authentik 的 sub (OpenID Connect Subject ID)
    /// </summary>
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
