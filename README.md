# 人格与记忆 · dsh-persona-memory

独立管理人格、公共/管理员/群聊/其他私聊核心记忆、长期记忆与关系图、日记、记忆整理、上下文压缩和自身备份恢复。默认仅作用于QQ会话，不修改全局默认预设。QQ接入、原始聊天存档、主动聊天和媒体功能由独立仓库[dsh-qq-gateway](https://github.com/Geng-zy/dsh-qq-gateway)负责。

维护入口：[本插件独立交接文档](docs/HANDOFF.md)。

```sh
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-persona-memory/releases/download/v2.7.0/dsh-persona-memory-2.7.0.tgz" --ignore-scripts
```

以dsh运行账号和相同DSH_HOME安装，等待在途任务完成并停dsh后执行，再按原方式启动。要求dsh0.2.1-rc.2、Node≥22.13。设置在“更多 → 设置 → 人格与记忆”。单独使用于网页会话时，将“会话生效范围”改为全部。

数据目录默认`DSH_HOME/persona-memory`。人格及核心稿下一次请求读取，旧会话无需/reset。长期记忆按管理员、每群、每位其他私聊用户分域；管理员可读取所有域，其他会话只读自己的域和公共域。终端/文件权限保持原样，隔离仅适用于记忆接口。

备份项目为人格、核心记忆、日记、长期记忆和关系图、插件设置；默认最多5份，成功新建后清理最旧包。上传tar.gz可识别文件并多选恢复，未选项目保留。密钥不导出，核心/人格只备份现稿，不备份QQ原始聊天数据。

旧统一插件升级请阅读[拆分迁移](https://github.com/Geng-zy/dsh-qq-gateway/blob/main/docs/SPLIT-MIGRATION.md)，不可与旧包并行加载。


## 独立开发

本仓库包含完整源码与构建脚本，不依赖QQ仓库的源码目录。

```sh
pnpm install
pnpm run build
pnpm test
```

TypeScript源码位于`src/companion`，界面源码位于`src/client`。生成文件位于`lib`，发布时使用`pnpm pack`。与QQ接入的端到端联调在QQ仓库运行；本仓库可独立构建、运行单元测试和安装。

## 导出文件说明

新备份自带人可读迁移指南、逐文件JSON说明以及实际SQLite表/字段/引用说明，可交给dsh适配其他插件。说明与数据一起校验，不重复导出正文，也不扩大所选备份范围。[文件格式与迁移方法](docs/BACKUP-FORMAT.md)。

## 开发者更新提醒

在设置的“开发者选项 → 依赖与上游更新”中启用，默认关闭。启用后默认每7天检查，两个插件各自配置邮件/微信、各自通知，不巡检宿主或自动升级。覆盖完整依赖、上游代码/资源及对接服务，并可用独立模型生成脱敏更新交接文档。

[使用与隐私说明](docs/UPDATES.md) · [完整依赖清单](docs/DEPENDENCIES.md) · [机器可读清单](docs/DEPENDENCIES.json)
