# 完整环境备份

普通 companion 备份仍用于选择性导入，格式不变、不含密钥。完整环境包由管理员安装的独立服务创建，包含凭据，供离线恢复应用数据和配置，不可上传普通导入入口。人格和核心记忆仅备份现稿。

## 安装（Ubuntu / systemd）

管理员准备一个私有 JSON 配置，权限 600。以下为占位示例，替换用户、UID/GID和真实路径；不要把生产配置上传到仓库。

```json
{
  "directory": "/var/lib/dsh-environment-backup",
  "uid": 1000,
  "gid": 1000,
  "services": ["dsh", "napcat"],
  "sources": ["/home/bot/.dsh", "/home/bot/workspace", "/home/bot/pkgs", "/home/qq/.config/QQ", "/home/qq/Napcat/opt/QQ/resources/app/app_launcher/napcat/config", "/etc/systemd/system/dsh.service", "/etc/systemd/system/napcat.service"],
  "required": ["/home/bot/.dsh", "/home/qq/.config/QQ", "/etc/systemd/system/dsh.service"],
  "exclude": ["/home/bot/.dsh/cache", "/home/bot/.dsh/companion/backups", "/home/bot/.dsh/companion/persona/history", "/home/bot/.dsh/companion/core/history-master", "/home/bot/.dsh/companion/core/history-public"]
}
```

QQ、Node、dsh 程序及运行依赖不进入备份。所有源目录中的 `node_modules` 在复制前统一跳过；不要将程序安装目录加入 `sources`。可在根配置的 `software` 对象记录当前版本号，写入清单以便重装。

`sources` 中加入实际使用的插件旧包目录、服务 drop-in/环境文件、QQ 登录目录，以及备份服务自身的脚本/配置/unit。不要使用 `/` 等全盘根路径，备份目录必须在源目录外。不存在的可选源跳过；`required` 缺失则失败。安装：

```bash
sudo bash scripts/install-environment-backup.sh /private/config.json
```

默认目录固定为 `/var/lib/dsh-environment-backup`。自定义目录时通过 dsh 服务环境变量 `DSH_ENVIRONMENT_BACKUP_DIR` 指定同一目录。服务每 30 秒检查请求和计划，不向 dsh 用户授予 sudo；插件只能创建备份请求。首次安装定时计划关闭，在插件「备份和日志 → 完整环境备份」选择每天/每周、时间和保留数后保存。时间采用插件时区，自动/手动总共最多 5 份。

## 运行与下载

系统服务先检查所需路径和空间，再停止原来运行的服务，复制一致数据，立即恢复服务，然后压缩并逐文件验证。包中保留文件权限、UID/GID和符号链接。仅成功包进入下载列表，成功后清理最早超额备份。失败不删除原包；复制异常会恢复原服务。强制终止后的下一次 worker 检查会恢复中断前运行的服务；机器断电仍受正常开机恢复流程约束。

设置页显示排队、复制、压缩、成功、失败、SHA-256和下载链接。POST 入口要求 JSON 并沿用 dsh 登录鉴权；下载也需登录。完整包是含密钥的私密 tar.gz，不自动上传第三方，不在清单/日志中展示密钥值。服务器目录仅 root 与 dsh 组可读，任务收件箱仅 dsh 用户可写。

离机副本：通过 SSH 下载列表中的 `.tar.gz` 和 `.sha256`，在电脑校验 SHA-256 后再替换/清理本地旧副本，保留最多 5 份。电脑端不安装自动同步任务；需要副本时由用户手动下载和校验。

## 验证与恢复

```bash
sudo python3 scripts/environment-backup.py verify --archive /private/environment-....tar.gz
# 默认仅验证并列出恢复范围，不改数据：
sudo python3 scripts/environment-backup.py restore --archive /private/environment-....tar.gz
# 确认后实际恢复；在目标服务器准备相同 UID/GID 的用户并确保有足够空间：
sudo python3 scripts/environment-backup.py restore --archive /private/environment-....tar.gz --apply
```

恢复首先验证完整清单、所有文件哈希和路径；解开到私有临时目录后，停止目标上原来运行的相关服务，按源目录替换，旧目录保留为 `.before-restore-*`。替换失败会回退已经替换的目录；成功后 daemon-reload 并恢复原来运行的服务。恢复前先安装清单中记录的 QQ、Node、dsh 版本。新包不包含 node_modules；恢复时保留目标机器已安装的同路径依赖，避免替换数据目录时误删。全新服务器需管理员核对安装路径、用户、网络地址，重装 profile 所需依赖并手动 enable/start 相应服务。包内 QQ 登录数据用于恢复原环境，不保证能直接被 SnowLuma 使用，也不保证 QQ 服务端不会要求重新登录。

本功能备份指定的数据、私密配置、服务定义和插件安装包，不包含 QQ 程序、Node、dsh 程序及运行依赖，不是可启动的磁盘镜像；操作系统、内核、云安全组、SSH 私钥及未列入源配置的其他目录不在其中。实际恢复前保留目标当前数据；不在正在运行的网页中执行全环境覆盖。
