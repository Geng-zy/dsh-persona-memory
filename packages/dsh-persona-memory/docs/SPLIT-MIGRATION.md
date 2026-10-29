# 从统一版迁移到两个插件

适用于本仓库1.x统一版。两个新包都使用2.0.0；内部配置命名空间`snowluma-bridge`和`companion-core`保留，方便沿用Token、模型及原设置。不要同时启用旧包和新包。

## 迁移前

等待模型回复、生图和待发队列全部完成，再停止dsh。保留原profile的package.json、pnpm-lock.yaml、cordis.yml/cordis.patch.yml，以及DSH_HOME下的`storages`、`companion`、`snowluma-bridge`目录。`storages`包含工作区归档状态；只恢复旧安装包不能撤销已归档标记。逻辑会话文件原件保留，迁移不会清空QQ登录。

以原dsh运行账号下载[发行页](https://github.com/Geng-zy/dsh-snowluma-companion/releases/tag/v2.0.0)的两个tgz，分别解压到独立临时目录。将`QQ包解压目录/package/deploy`中的两个脚本视为待审查的迁移工具。

## 迁移配置和安装

迁移配置脚本使用YAML AST保留密钥节点，将QQ相关设置移动到QQ命名空间，保留其余人格记忆设置。需要已安装依赖的源码目录，或安装到目标profile后执行对应工具。若只是解开tgz而没有依赖，不能直接运行需要yaml模块的脚本。

下面示例通过临时工具目录安装依赖；把所有大写占位路径替换成自己的**绝对路径**：

```sh
cd /绝对路径/临时工具目录
pnpm init
pnpm add yaml@2.9.1
# 将QQ发行包的deploy目录复制到这个工具目录，再执行：
node deploy/migrate-profile.mjs /绝对路径/DSH_HOME/profiles/web /绝对路径/dsh-qq-gateway-2.0.0.tgz /绝对路径/dsh-persona-memory-2.0.0.tgz
cd /绝对路径/DSH_HOME/profiles/web
pnpm install --ignore-scripts
```

保持dsh停止，使用已安装的QQ插件迁移数据：

```sh
node /绝对路径/DSH_HOME/profiles/web/node_modules/dsh-qq-gateway/deploy/migrate-data.mjs /绝对路径/DSH_HOME
```

此工具拒绝覆盖已存在的新数据目录，原目录保持不变。它将原SQLite分别生成两个一致快照：QQ目录仅含原始消息、分类、过期状态；人格目录仅含长期记忆、关系图、日记索引与整理元数据。人格、核心稿和日记复制到人格目录；媒体和会话映射复制到QQ目录。原备份最新最多五份按归属重新打包、校验，各插件独立保留。

新目录为`DSH_HOME/qq-gateway`和`DSH_HOME/persona-memory`。如果使用了自定义旧数据目录或更早的两个独立插件，不应照搬该工具；先核对实际目录和配置。

## 启动与检查

按原方式启动dsh。QQ插件先注册`DSH_HOME/workspaces/QQ`，逐个完整复制旧QQ会话，核对事件后切换映射并归档原会话。原会话的历史不删除；新ID包含`-ws-`后缀。原本已归档的会话副本仍保持归档。运行中会话延后处理；复制中断后仅在内容为正确前缀时补齐，内容冲突会停止切换并报告错误。

检查两个设置入口、人格和核心稿、长期记忆域、各自备份清单、QQ登录及工作区内历史。此迁移只重启dsh，不要求重启SnowLuma。实际QQ连接仍沿用原反向WS和Token。

人格默认仅QQ会话；管理员通过记忆接口可读取所有域，其他群和私聊只读公共与自身域。按设计保留原终端/文件工具权限，因此记忆接口分域不构成文件沙箱。

## 回退

先停止dsh，恢复原profile及`storages`，重新安装原依赖，再用原`companion`和`snowluma-bridge`目录启动。保留新目录供核对，不能直接覆盖；原会话文件仍在。回退过程中不要触碰SnowLuma命名卷、密码或QQ账号。恢复存储快照前须确认新版本尚未产生需要保留的新业务数据。
