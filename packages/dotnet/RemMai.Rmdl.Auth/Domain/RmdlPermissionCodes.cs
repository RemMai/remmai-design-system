namespace RemMai.Rmdl.Auth.Domain;

public static class RmdlPermissionCodes
{
    /// <summary>
    /// 超级管理员统配权限
    /// </summary>
    public const string All = "*";

    /// <summary>
    /// 系统配置读写
    /// </summary>
    public const string SystemConfig = "system:config";

    /// <summary>
    /// 账号与角色管理
    /// </summary>
    public const string UserManage = "user:manage";

    /// <summary>
    /// 业务模块编辑与管理
    /// </summary>
    public const string BusinessManage = "business:manage";

    /// <summary>
    /// 业务模块数据只读浏览
    /// </summary>
    public const string BusinessView = "business:view";
}
