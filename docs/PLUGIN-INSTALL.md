# 已有dsh：单独安装或升级插件

本页使用dsh官方插件命令，将GitHub发行的已编译`.tgz`安装到已有profile。完整环境部署见[一键安装](INSTALL.md)，需要分步部署整个环境时见[手动安装](MANUAL-INSTALL.md)。

## 网页版：一条插件安装命令

要求dsh **0.2.1-rc.2**、Node **≥22.13**及可用的pnpm。先停止目标dsh进程，以**运行dsh的同一账号**执行，并保持相同的`DSH_HOME`；未设置时使用该账号的默认`.dsh`目录。

```sh
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v1.4.2/dsh-snowluma-companion-1.4.2.tgz" --ignore-scripts
```

这是GitHub发行包地址，不是npm包名。包内已经包含编译后的服务端和界面，`--ignore-scripts`即可安装；由dsh管理依赖并在首次安装时加入profile的bundle。其他原有bundle和设置保留。

安装完成后按原方式启动dsh。使用systemd管理时，由管理员停止和启动原来的服务；插件安装命令仍由业务账号执行。进入**更多 → 设置 → SnowLuma陪伴助手**，填写主人QQ、连接Token等配置。QQ连接另需已有SnowLuma及相匹配的反向WS客户端，参见[接入说明](SNOWLUMA.md)。

这里仅管理插件包，不安装整套Docker、SnowLuma、Node或dsh环境。

## 找不到dsh或pnpm命令时

先确认正在使用原来的dsh运行账号。若dsh安装在自定义目录，可用其完整命令路径；不要因此改用root账号的profile。

**通过本仓库一键脚本安装的环境**使用以下目录，可以在该业务账号的Bash终端执行：

```bash
export PATH="$HOME/.local/node/bin:$HOME/.local/dsh/node_modules/.bin:$PATH"
cd "$HOME/.local/dsh"
npx --yes pnpm@11.28.5 exec dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v1.4.2/dsh-snowluma-companion-1.4.2.tgz" --ignore-scripts
```

`npx`提供指定版本的pnpm，由其运行已有dsh命令。若你采用其他安装目录，应按实际位置调整；不要在不相关的账号或profile下照抄路径。

## 已下载发行包：从本地安装

服务器无法下载GitHub资产时，在可访问GitHub的电脑从[发行页](https://github.com/Geng-zy/dsh-snowluma-companion/releases/tag/v1.4.2)下载插件`.tgz`，上传到运行dsh的账号可读取的位置，再执行：

```sh
dsh plugin --profile web add "/绝对路径/dsh-snowluma-companion-1.4.2.tgz" --ignore-scripts
```

使用本地包时，依赖仍需要可用网络或缓存；缓存齐全时可在命令末尾加`--offline`。

## 选择正确的profile

- 网页版通常为`--profile web`；TUI改为`--profile tui`；自定义profile填写实际名称。
- `web`是profile名称，不是目录路径。数据位于对应`DSH_HOME/profiles/<名称>`中。
- 桌面版由桌面应用管理其profile，直接在应用内插件管理安装发行包即可；上面的普通命令行示例面向web/TUI。

## 升级

已安装本统一插件时，停止dsh后，用同样的`plugin add`命令指定目标版本的发行包，再按原方式启动。升级保留已有启用状态、人格、核心记忆和设置；原来未启用的bundle不会被dsh自动重新启用。

如果当前仍分别安装两个旧插件，需要合并bundle和旧模块引用，使用[README中的迁移流程](../README.md#安装与升级)，完成后只保留统一插件。不要让两套旧模块与统一包同时加载。

验证范围：已在隔离的已有web profile上运行真实`dsh plugin --profile web add <本地发行包> --offline --ignore-scripts`，确认包版本正确、bundle只加入一次、原有bundle及配置文件保留。此处的命令不是整套环境安装器。
