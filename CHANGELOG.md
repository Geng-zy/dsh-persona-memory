# 更新记录

## 0.21.1

- Compose 通过启动包装脚本启用已认证VNC连接的共享模式，避免旧连接未释放时，新连接在密码校验后立即被拒绝；保留原认证与官方启动流程。

## 0.21.0

- 插件统一命名为 dsh-snowluma-bridge，包名、服务、事件、设置命名空间、存储目录与会话标识全面使用 SnowLuma，不保留旧标识兼容层；配套 companion-core 0.18.0。
- 兼容 SnowLuma OneBot v11 反向 WebSocket、媒体 URL/base64、容器外文件及视频发送与转发。
- 提供固定版本的 Docker Compose 模板、部署说明和媒体回归测试。QQ 权限、唤醒、群回复目标、主动聊天与存档功能保留。
