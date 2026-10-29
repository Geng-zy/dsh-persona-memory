import z from '@deepseek-ai/schemastery'
import { IMAGE_PROVIDERS, type ImageProvider } from '../image-generation.js'
export interface QqFeatureConfig {
  imageGenEnabled: boolean
  imageGenProvider: ImageProvider
  imageGenApiUrl: string
  imageGenApiKey: string
  imageGenModel: string
  imageGenOptions: string
  imageGenCommand: string
  imageGenPrivate: boolean
  imageGenGroup: boolean
  imageGenTimeoutSeconds: number
  imageGenMaxImages: number
  imageGenMaxMB: number
  imageGenKeepDays: number
  archiveEnabled: boolean
  archiveUnwoken: boolean
  archiveDaysMaster: number
  archiveDaysOthers: number
  groupContextCount: number
  rotateSessions: boolean
  deleteOldSessions: boolean
  carryMessages: number
  archiveImages: boolean
  proactiveEnabled: boolean
  proactiveMinMinutes: number
  proactiveMaxMinutes: number
  proactiveOthersMinMinutes: number
  proactiveOthersMaxMinutes: number
  proactivePrivate: boolean
  proactiveGroup: boolean
  quietStart: string
  quietEnd: string
  proactiveRecentMinutes: number
  proactiveGroupContext: number
  proactiveActiveDays: number
  backupEnabled: boolean
  backupTime: string
  backupKeep: number
  backupItems: string[]
}
export const qqFeatureSchema = {
  imageGenEnabled: z.boolean().default(false).volatile().description('启用图片生成工具；关闭时不调用生图服务'),
  imageGenProvider: z.union(Object.keys(IMAGE_PROVIDERS) as ImageProvider[]).default('modelscope').volatile().description('图片生成协议；独立于聊天模型提供商'),
  imageGenApiUrl: z.string().default('https://api-inference.modelscope.cn/v1').volatile().description('生图基础地址；Azure、Vertex和自定义HTTP填写完整端点'),
  imageGenApiKey: z.string().role('secret').volatile().description('生图服务密钥或Bearer令牌；不回显、不导出到备份'),
  imageGenModel: z.string().default('Qwen/Qwen-Image-2.1').volatile().description('生图模型或部署ID；使用提供商实际支持的标识'),
  imageGenOptions: z.string().default('{}').volatile().description('额外JSON参数，ComfyUI工作流或自定义HTTP模板；不要填写密钥，认证模板用{{apiKey}}'),
  imageGenCommand: z.string().default('').volatile().description('本地程序JSON参数数组，首项为可执行文件绝对路径；不经过Shell，提示词通过stdin JSON传入'),
  imageGenPrivate: z.boolean().default(false).volatile().description('允许白名单中的其他人私聊使用生图'),
  imageGenGroup: z.boolean().default(false).volatile().description('允许获准群聊回复使用生图；沿用群聊和管理员权限规则'),
  imageGenTimeoutSeconds: z.natural().min(10).max(1800).default(180).volatile().description('一次生图总超时秒数，包含提交、轮询、下载；取消不保证远端退款'),
  imageGenMaxImages: z.natural().min(1).max(4).default(1).volatile().description('每次最多生成图片张数；部分接口会逐张提交，分别计费'),
  imageGenMaxMB: z.natural().min(1).max(50).default(20).volatile().description('每张生成图片的最大下载大小，单位MB'),
  imageGenKeepDays: z.natural().min(1).max(365).default(7).volatile().description('本地生成图片保留天数，每次生成后清理，并最多保留100张；不包含在普通插件备份中'),
  archiveEnabled: z.boolean().default(true).volatile().description('本插件的消息存档；不控制 SnowLuma 或 QQ 客户端的协议缓存'),
  archiveUnwoken: z.boolean().default(true).volatile().description('保存没唤醒她的群消息'),
  archiveDaysMaster: z.natural().min(1).default(365).volatile().description('主人私聊存档保留天数'),
  archiveDaysOthers: z.natural().min(1).default(5).volatile().description('其他私聊和群聊存档保留天数'),
  groupContextCount: z.natural().default(10).volatile().description('参与群话题时附上群里最近几条消息（含她自己说的；图片不限张数；0 = 不附）'),
  rotateSessions: z.boolean().default(true).volatile().description('会话用满存档保留期就换新会话'),
  deleteOldSessions: z.boolean().default(true).volatile().description('其他人的旧会话过期后删除（主人的永不删）'),
  carryMessages: z.natural().default(10).volatile().description('换会话时带过去最近几条消息'),
  archiveImages: z.boolean().default(true).volatile().description('收到图片时下载存起来（QQ 图片链接会过期）'),
  proactiveEnabled: z.boolean().default(true).volatile().description('主动聊天：随机间隔唤醒她，让她决定要不要说话'),
  proactiveMinMinutes: z.natural().min(10).default(60).volatile().description('主人私聊：最短间隔（分钟）'),
  proactiveMaxMinutes: z.natural().min(10).default(240).volatile().description('主人私聊：最长间隔（分钟）'),
  proactiveOthersMinMinutes: z.natural().min(10).default(120).volatile().description('其他私聊和群聊：最短间隔（分钟）'),
  proactiveOthersMaxMinutes: z.natural().min(10).default(240).volatile().description('其他私聊和群聊：最长间隔（分钟）'),
  proactivePrivate: z.boolean().default(true).volatile().description('也主动找别人私聊'),
  proactiveGroup: z.boolean().default(true).volatile().description('也在群里主动说话'),
  quietStart: z.string().default('01:00').volatile().description('免打扰开始（HH:MM）'),
  quietEnd: z.string().default('09:00').volatile().description('免打扰结束（HH:MM）'),
  proactiveRecentMinutes: z.natural().default(30).volatile().description('她这么多分钟内在这个会话里说过话就不触发'),
  proactiveGroupContext: z.natural().default(15).volatile().description('群里主动说话时带几条上下文（图片不限张数）'),
  proactiveActiveDays: z.natural().min(1).default(7).volatile().description('别人和群：最近几天里聊过才主动找'),
  backupEnabled: z.boolean().default(true).volatile().description('每天自动备份QQ插件自己的数据与设置'),
  backupTime: z.string().default('04:00').volatile().description('QQ插件每日备份时间HH:MM'),
  backupKeep: z.natural().min(1).max(5).default(5).volatile().description('QQ插件所有类型备份合计最多保留五份；新包成功后删除最旧包'),
  backupItems: z.array(z.string()).default(['archiveMaster','settingsBridge']).volatile().description('QQ插件的备份内容'),
}
