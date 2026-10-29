# 只安装插件

要求 dsh0.2.1-rc.2、Node≥22.13、可用pnpm。先等待在途任务完成并停止dsh，以运行dsh的原系统账号和原DSH_HOME执行：

```sh
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v2.0.1/dsh-qq-gateway-2.0.1.tgz" --ignore-scripts
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v2.0.1/dsh-persona-memory-2.0.1.tgz" --ignore-scripts
```

可只装所需插件。普通web profile使用`--profile web`；TUI改为`tui`。安装后按原方式启动dsh。设置入口分别为“更多 → 设置 → QQ 接入助手 / 人格与记忆”。

若采用本仓库安装器，先设置命令路径：

```sh
export PATH="$HOME/.local/node/bin:$HOME/.local/dsh/node_modules/.bin:$PATH"
```

从[发行页](https://github.com/Geng-zy/dsh-snowluma-companion/releases/tag/v2.0.1)下载tgz后，也可用同一`plugin add`命令填写本地绝对路径；依赖仍需网络或缓存。桌面版使用应用插件管理安装对应tgz。

旧统一插件升级必须先执行[拆分迁移](SPLIT-MIGRATION.md)。不要同时加载旧统一插件与新插件，否则会重复监听和处理消息。后续同名新插件升级可直接指定新版tgz，保留原配置与数据。

单装QQ插件需自己配置SnowLuma反向WS、相同Token、管理员QQ、白名单、聊天模型及可选媒体服务；默认自动建立QQ工作区。人格插件默认QQ-only，不接管普通网页会话，需要时自行改生效范围。高权限终端/文件工具沿用原预设，记忆接口隔离不等于文件沙箱。
