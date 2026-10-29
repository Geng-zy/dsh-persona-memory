# 人格与记忆 · dsh-persona-memory

独立管理人格、公共/管理员/群聊/其他私聊核心记忆、长期记忆与关系图、日记、记忆整理、上下文压缩和自身备份恢复。默认仅作用于QQ会话，不修改全局默认预设。QQ接入、原始聊天存档、主动聊天和媒体功能由同仓库`dsh-qq-gateway`负责。

```sh
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v2.0.0/dsh-persona-memory-2.0.0.tgz" --ignore-scripts
```

以dsh运行账号和相同DSH_HOME安装，等待在途任务完成并停dsh后执行，再按原方式启动。要求dsh0.2.1-rc.2、Node≥22.13。设置在“更多 → 设置 → 人格与记忆”。单独使用于网页会话时，将“会话生效范围”改为全部。

数据目录默认`DSH_HOME/persona-memory`。人格及核心稿下一次请求读取，旧会话无需/reset。长期记忆按管理员、每群、每位其他私聊用户分域；管理员可读取所有域，其他会话只读自己的域和公共域。终端/文件权限保持原样，隔离仅适用于记忆接口。

备份项目为人格、核心记忆、日记、长期记忆和关系图、插件设置；默认最多5份，成功新建后清理最旧包。上传tar.gz可识别文件并多选恢复，未选项目保留。密钥不导出，核心/人格只备份现稿，不备份QQ原始聊天数据。

旧统一插件升级请阅读[拆分迁移](https://github.com/Geng-zy/dsh-snowluma-companion/blob/main/docs/SPLIT-MIGRATION.md)，不可与旧包并行加载。
