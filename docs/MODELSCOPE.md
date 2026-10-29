# 魔搭聊天模型：角色兼容设置

适用于dsh 0.2.1-rc.2的自定义`openai-completions`提供商，特别是配置了思考能力的DeepSeek模型。

## 报错与原因

```text
400 invalid_parameter_error
 developer is not one of ['system', 'assistant', 'user', 'tool', 'function']
```

dsh使用的pi-ai兼容层会根据模型的思考能力与`supportsDeveloperRole`决定将系统指令编码为`developer`还是`system`。未知的自定义服务可能被默认认为支持developer，而魔搭该端点不接受这个角色，因此请求被400拒绝。即便等待约一分钟后才看到错误，也不能仅凭等待时长判断为超时、白名单或额度问题。新旧会话都可能受影响，并不只是旧聊天记录的问题。

## 官方配置项修复

在目标profile的`cordis.patch.yml`中，找到已有`llm-pi-ai`配置行，在已有魔搭提供商中**合入**以下compat字段：

```yaml
- id: llm-pi-ai
  config:
    providers:
      modelscope:
        compat:
          supportsDeveloperRole: false
```

这里只展示增量位置。保留已有的baseURL、apiKeyEnv、models、reasoningEfforts及其他compat选项，不要用示例替换整个提供商或整个profile。提供商ID不是`modelscope`时使用实际ID；已有每模型compat覆盖时也需要检查它是否重新打开此能力。手工改文件应先停止dsh，完成后按原方式启动。

该选项让传给魔搭的系统指令使用`system`角色，不删除或改写会话，不删除人格/核心记忆/长期记忆，不关闭模型思考，也不改群白名单或强行切换聊天模型。通常无需`/reset`。后续请求会使用修复后的序列化配置。

本插件不会自动修改所有新建自定义提供商的兼容声明，也不修改dsh依赖源码。不同服务实际支持的角色不同；此设置针对魔搭该接口，不应无差别套用所有厂商。

## 验证范围

回归测试调用当前实际安装的pi-ai Chat Completions转换器：复现支持developer时生成被拒绝角色，再验证关闭该能力后输出system，保留最新人格/上下文、用户消息及历史回复，且输入会话数据不被改写。未为验证额外调用用户的生产付费/免费模型额度，也未向真实QQ发送测试消息。

参考：[魔搭官方API示例](https://www.modelscope.cn/posts/1010?pid=1009)。
