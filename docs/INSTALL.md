# 一键部署全新服务器

已有dsh、只需要安装本插件时，使用[单独安装插件命令](PLUGIN-INSTALL.md)。下方安装器用于完整的全新环境部署。

需要逐步安装和自行配置时，请使用[手动安装图文教程](MANUAL-INSTALL.md)。

Ubuntu26.04已加入安装器允许列表，Docker官方已支持该版本；尚未完成26.04全新虚拟机整机安装实测。已有的实际dsh/profile、Docker及systemd验证不等于所有Ubuntu版本均已完成整机验证。

适用Ubuntu22.04/24.04/26.04、amd64/arm64、systemd及可用的sudo/root终端。部署当前验证的软件组合：Node24.22.1、dsh0.2.1-rc.2、SnowLuma官方镜像及本插件1.4.2。用于全新环境；不会把开发者的QQ登录、密码、人格、记忆或聊天数据放入公开仓库。

需要目标服务器能够访问GitHub、Node官方站、npm和系统软件源；Docker镜像也需要可下载或事先导入。网络不可达时不能保证在线一条命令完成，不会自动使用未经选择的第三方下载源。

## 一条命令

在**目标Ubuntu服务器的SSH终端**执行，不是在本机Mac终端直接部署：

```sh
curl -fsSL https://raw.githubusercontent.com/Geng-zy/dsh-snowluma-companion/main/install.sh | sudo bash
```

也可先下载阅读，再执行：

```sh
curl -fsSL https://raw.githubusercontent.com/Geng-zy/dsh-snowluma-companion/main/install.sh -o install.sh
sudo bash install.sh
```

入口固定到对应版本的安装器并校验其SHA256；插件包从该版本GitHub Release获取并核对资产digest，Node也校验官方SHASUMS256。使用系统正常证书校验，不自动切换第三方镜像源或修改Docker daemon.json。

## 部署时自己填写

终端会依次询问：

- dsh普通业务账号、部署目录、浏览器访问的公网IPv4/域名、dsh监听的本机IPv4。
- dsh网页、反向WS、SnowLuma管理页、远程桌面、OneBot HTTP及正向WS端口；默认3080/6199/5099/6081/3000/3001，不允许重复。
- 主人QQ号（不是机器人QQ号）。
- SnowLuma管理密码并确认：沿用官方强度规则，至少10位、大小写字母和特殊符号、无空白。
- VNC密码并确认：8个可见ASCII字符，符合VNC认证的8字节限制。
- OneBot Token：可以自行填写，也可回车生成并在结束时输出。
- DeepSeek Messages兼容接口根地址、模型ID、API Key；默认官方`https://api.deepseek.com/anthropic`和`deepseek-flash`。API Key允许留空后在模型页填写，此时不会声称模型已可用。
- SnowLuma镜像，默认官方latest；也可输入自己已导入的镜像。下载失败会让用户决定替代来源，不悄悄修改镜像源。

密码和Key输入隐藏回显。程序不会设置/修改你的SSH或root密码；创建的dsh业务账号未设置系统登录密码。

dsh不支持监听0.0.0.0，脚本按官方接口绑定用户填写的具体本机IPv4，并为公网地址配置public-url/trusted-host；云服务器的公网NAT地址通常不能作为本机绑定地址。反向WS仍监听0.0.0.0以供Docker网关连接。

## 安装内容及默认行为

需要时通过Docker官方Ubuntu软件源安装Docker Engine及Compose；已有可用Docker/Compose则复用，不自动卸载旧软件包。安装系统依赖、ffmpeg、用户目录内的Node/dsh、统一插件和dsh.service。

SnowLuma沿用仓库里的官方默认模板和三个官方命名卷，仅保留host-gateway映射、dsh反向WS客户端，以及本次用户明确填写的端口和凭据。密码通过官方支持的VNC_PASSWD和SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD环境变量配置，不修改认证源码；没有新增内存上限、日志轮转、VNC补丁或固定QQ账号启动参数。#sl仍保留官方默认回复，独立于插件白名单。

发现已有dsh服务、目标安装目录、业务账号下已有dsh/Node资料，或SnowLuma容器/命名卷时停止，不接管和覆盖。需要迁移现有环境时先准备数据迁移方案，不能把此脚本当强制重装命令。

## 完成后输出与凭证

脚本实际验证：SnowLuma/noVNC本机HTTP就绪、填写的管理密码可登录、dsh官方Token登录及插件/数据库接口可用；通过后才标记软件部署完成。不会代发QQ测试消息或产生聊天模型测试费用。

结束时输出并保存：

- dsh网页和当前带Token登录链接；dsh没有固定用户名/密码。
- SnowLuma管理页与管理密码；此版本登录只需密码，不另设自定义用户名。
- QQ远程桌面网址及VNC密码，VNC不需要用户名。
- OneBot HTTP、正向WS、容器内反向WS地址和Token。
- 主人QQ、模型地址/ID/Key、业务账号、部署目录、状态命令和查看凭证命令。

默认部署目录`/opt/dsh-snowluma-companion`，凭证文件`访问地址与凭证.txt`及`credentials.json`仅root可读，目录0700、文件0600。用户输入的密码及Key不会进入GitHub或测试结果。

dsh服务重启会更换启动登录Token，之后重新获取：

```sh
sudo python3 /opt/dsh-snowluma-companion/install.py --show-info /opt/dsh-snowluma-companion
```

如安装时更改了目录，请使用所选目录。查看命令会输出当前登录链接和保存的初始凭证；用户后来自行改过的SnowLuma密码不会被脚本反向读取或自动覆盖，需要自行更新保存的凭证记录。

软件服务就绪不等于QQ已登录。首次协议确认和QQ扫码需要账号本人在输出的网址操作；群聊/其他私聊白名单默认空，按需在统一设置页配置。人格和记忆等资料可在“备份与迁移→恢复备份”导入自己的备份。

公网可达还需用户在云安全组/防火墙放行所选服务器端口。网页访问需要dsh端口、5099/6081对应端口；3000/3001仅在外部客户端使用时按需放行，6199用于容器到宿主，不需要为本地容器连接另行开公网。脚本不会擅自改变云规则。

## 预览、中断续装与离线文件

下载入口后，先交互预览脱敏配置：

```sh
sudo bash install.sh --dry-run
```

已写入本安装器的私有状态记录后，若网络中断等导致失败，可继续未完成步骤：

```sh
sudo python3 /opt/dsh-snowluma-companion/install.py --resume /opt/dsh-snowluma-companion
```

续装仅识别本次安装记录和已声明的数据卷，不接管其他已有部署；已完成阶段不重复安装。已完成安装使用--show-info，不能通过--resume强制覆盖。若失败发生在安装记录创建之前（例如系统软件源错误），修复网络/包管理器后重新运行入口即可。

也支持事先上传文件：

```sh
sudo bash install.sh --plugin-archive /绝对路径/dsh-snowluma-companion-1.4.2.tgz --image-archive /绝对路径/snowluma-image.tar
```

如果服务器连GitHub raw都不可达，在网络可用的电脑下载本仓库Release的tgz后上传到新服务器，直接运行包内安装器，可绕过在线入口和GitHub插件下载：

```sh
mkdir companion-install
# 将下载的同版本tgz上传到当前目录后执行
# 归档来源由你自行核验
tar -xzf dsh-snowluma-companion-1.4.2.tgz -C companion-install
sudo python3 companion-install/package/deploy/install.py --plugin-archive "$PWD/dsh-snowluma-companion-1.4.2.tgz"
```

本地插件包需由操作者核验来源；本地镜像导入后仍需选择正确的镜像名称。Node/npm及系统软件源仍需要相应网络或缓存，本选项不是完整离线系统安装包。

## 验证范围

安装器的输入/私密文件/包解压/配置一致性/中断续装/就绪判定有Python回归；打包后的全新dsh profile实际启动并核验公网Host信任、登录、模型选择、插件及数据库。Linux上核验真实systemd服务解析、Compose容器内密码特殊字符、已有环境拒绝，以及隔离官方SnowLuma的真实密码登录。

这些隔离测试不等同于在全新虚拟机上完整重装操作系统和全部依赖；不会为了验证入口而重装现有生产服务器。业务回归继续由scripts/check.sh执行。
