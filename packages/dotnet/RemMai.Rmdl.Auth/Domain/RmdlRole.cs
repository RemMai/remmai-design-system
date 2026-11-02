using FreeSql.DataAnnotations;

namespace RemMai.Rmdl.Auth.Domain;

[Table(Name = "rmdl_roles")]
public class RmdlRole
{
    [Column(Name = "id", IsPrimary = true, IsIdentity = true)]
    public int Id { get; set; }

    [Column(Name = "code", StringLength = 64)]
    public string Code { get; set; } = "user";

    [Column(Name = "name", StringLength = 64)]
    public string Name { get; set; } = "普通用户";

    [Column(Name = "is_system")]
    public bool IsSystem { get; set; } = false;

    /// <summary>
    /// JSON 序列化的权限代码清单，例如 ["*"] 或 ["business:view"]
    /// </summary>
    [Column(Name = "permissions_json", StringLength = 2048)]
    public string PermissionsJson { get; set; } = "[]";
}
