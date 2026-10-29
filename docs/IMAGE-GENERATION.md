# 图片生成接入

版本1.4.0新增独立的`generate_image`工具。它不把生图模型注册成聊天模型：dsh继续用聊天模型理解请求，再调用生图接口，QQ会话直接发送图片，网页会话通过dsh附件展示工具结果。支持文字生成图片；并非通用图像编辑器，参考图、遮罩和全部厂商专属编辑能力不在此版本范围。

## 使用步骤

1. 打开**更多 → 设置 → QQ 接入助手 → 图片、语音与视频 → 图片生成**。
2. 在“服务配置”页签开启图片生成，选择接口协议，核对地址及模型，填写该服务的密钥。协议选择会填入参考地址/模型并重置高级参数；模型示例不代表永久有效或账号一定有权限。
3. 保存所有设置。切换到“试画与图库”，在“试画提示词”中填写描述，点击“生成一张（消耗额度）”。结果会在当前设置页展示，可以打开下载，不会发到QQ。
4. 在使用陪伴预设的会话中说“请画一张……”。须使用支持工具调用的聊天模型。插件在所有受管会话注册工具，执行时读取实时开关和权限，因此开关不需要`/reset`。

首次默认关闭；主人网页和主人QQ私聊在开启后可用。其他私聊、群聊默认不允许生图，各有开关，且仍执行现有白名单/管理员权限规则。生成前和发送前检查权限，不会把群聊生图变成读取主人私密记忆的入口。QQ图片使用Base64发送，不要求容器读取宿主文件。

## 内置协议及接入范围

这里的“支持”指实现对应请求、响应和任务轮询协议，并有模拟服务测试；不是已经持有每家账号、逐家验证付费出图。模型和地域可用性、鉴权、配额、参数及政策以服务商当前文档为准。

| 设置中的协议 | 地址填写方式 | 模型/参数说明 |
|---|---|---|
| OpenAI / compatible Images | 基础地址，通常至`/v1` | `/images/generations`，支持URL和`b64_json`结果。OpenAI、SiliconFlow、Together、Fireworks、Recraft、火山方舟Seedream及其他服务仅在其实际端点兼容此协议时适用；不保证任意同名“兼容接口”全部参数相同 |
| Azure OpenAI Images | 包含deployment及`api-version`的完整生成端点 | `api-key`鉴权，模型填写部署要求的标识 |
| ModelScope 魔搭 | `https://api-inference.modelscope.cn/v1` | 例如`Qwen/Qwen-Image-2.1`，提交异步任务，查询`/tasks/{id}` |
| Alibaba DashScope / Qwen / Wan | 地域对应基础地址，通常至`/api/v1` | 采用multimodal-generation对话式生成接口及任务轮询；适配支持该端点的Qwen/Wan模型。旧版Wan的text2image专用端点请使用自定义HTTP |
| Google Gemini image | Gemini API基础地址，通常至`/v1beta` | 填具备图片输出能力的具体模型，调用`:generateContent`并读取inlineData；普通聊天Gemini不一定能生图 |
| Google Imagen | Gemini API基础地址，通常至`/v1beta` | 填账号可用Imagen型号，调用`:predict` |
| Google Vertex Imagen | 项目、地域、publisher、model及`:predict`的完整端点 | 密钥栏填有效OAuth Bearer令牌；不自动刷新令牌，不自动创建GCP项目 |
| OpenRouter image chat | `https://openrouter.ai/api/v1` | 支持image输出的模型，通过chat/completions返回message.images |
| Black Forest Labs FLUX | `https://api.bfl.ai/v1` | 如`flux-2-pro`，使用x-key和polling_url；认证轮询须同源，不跨域转发密钥 |
| fal.ai queue | `https://queue.fal.run` | 填完整模型路径，如`fal-ai/flux/dev`；Key鉴权，status_url和response_url轮询 |
| Replicate predictions | `https://api.replicate.com/v1` | 模型填owner/model；高级参数指定version可改用版本预测接口，其余高级参数作为input |
| Stability AI | `https://api.stability.ai/v2beta` | 模型填`core`、`ultra`或支持的`sd3`路径；multipart请求、二进制图片响应 |
| Ideogram v3 | `https://api.ideogram.ai` | 模型填`ideogram-v3`，multipart生成；较新版本如采用不同JSON端点，使用自定义HTTP而非冒用v3协议 |
| Hugging Face hf-inference | `https://router.huggingface.co/hf-inference/models` | 模型填仓库ID，返回二进制图片；仅支持部署在hf-inference且支持此任务的模型，不是HF全部第三方提供商的统一接口 |
| AUTOMATIC1111 / Forge API | 通常`http://127.0.0.1:7860` | 后端以`--api`启用`/sdapi/v1/txt2img`；checkpoint等填高级参数 |
| ComfyUI API workflow | 通常`http://127.0.0.1:8188` | API格式工作流及节点输出，见下文；不是把网页导出的普通工作流原样粘贴 |
| Custom HTTP / async JSON | 完整提交端点 | 自定义JSON或multipart提交、认证头、结果字段和可选异步轮询 |
| Local program / Diffusers / cloud CLI | 不需要API地址 | 无Shell本地程序协议，可接Diffusers、AWS Bedrock、腾讯混元、百度千帆、华为、Adobe SDK或其他官方SDK/CLI；需自行配置程序与依赖 |

Midjourney等只有网页/Discord操作或没有公开通用开发接口的产品，不宣称原生支持。若使用其合法可用的网关，按网关实际协议选择兼容接口、自定义HTTP或本地程序。浏览器自动点击、绕过登录和把第三方非官方接口当官方API不属于本功能。

## 魔搭示例

- 协议：ModelScope 魔搭。
- 地址：`https://api-inference.modelscope.cn/v1`。
- 模型：`Qwen/Qwen-Image-2.1`（以账号当前模型页可用API为准）。
- 密钥：魔搭访问令牌，不是DeepSeek官方或阿里百炼Key。
- 高级参数：先用`{}`；如服务支持，可填`{"size":"1024x1024"}`等选项。

插件不会自动复制dsh聊天提供商的密钥，也不会自动开通额度。生图配额与聊天配额规则可能不同，不能将聊天调用次数当成可生成图片张数。

## ComfyUI示例

在ComfyUI中导出**API格式**工作流，放到高级参数的`workflow`中。修改正向提示词节点的`inputs.text`为`{{prompt}}`；负向提示词用`{{negativePrompt}}`，latent宽高可用`{{width}}`和`{{height}}`，采样种子用`{{seed}}`。例如：

```json
{
  "workflow": {
    "6": {"class_type":"CLIPTextEncode","inputs":{"text":"{{prompt}}","clip":["4",1]}},
    "7": {"class_type":"CLIPTextEncode","inputs":{"text":"{{negativePrompt}}","clip":["4",1]}}
  },
  "outputNodes": ["9"]
}
```

这里只示范模板位置，不是完整可运行工作流。必须包含你自己的checkpoint、latent、采样、解码和SaveImage等节点及正确连接。`outputNodes`可省略，此时读取所有输出节点中的非临时图片。缺少模型/节点会由ComfyUI拒绝；本插件不安装GPU运行环境。

## 自定义HTTP示例

同步JSON接口：

```json
{
  "body": {"model":"{{model}}","prompt":"{{prompt}}","width":"{{width}}","height":"{{height}}"},
  "headers": {"Authorization":"Bearer {{apiKey}}"},
  "resultPath":"data"
}
```

`resultPath`用点分路径，可包含数组下标，如`output.results`、`outputs.0.image.url`。结果支持字符串、字符串数组，以及带`url`、`b64_json`、`base64`、`image.url`的对象。返回原始图片字节时设`"binary":true`；需要表单时设`"multipart":true`。不要手写multipart的Content-Type，运行时自动生成boundary。

异步接口：

```json
{
  "body":{"prompt":"{{prompt}}"},
  "resultPath":"output.images",
  "poll":{
    "idPath":"task.id",
    "url":"https://images.example.com/tasks/{{taskId}}",
    "statusPath":"status",
    "success":["completed"],
    "failure":["failed","cancelled"]
  }
}
```

若提交响应直接提供完整轮询地址，可用`"urlPath":"statusUrl"`代替`url/idPath`。提交和带认证的轮询必须同源。`{{taskId}}`自动做URL组件编码，其他占位符不自动编码，建议将文本放在body。通用变量有prompt、negativePrompt、width、height、size、model、seed、apiKey。整段占位符保留数字等JSON类型；嵌入字符串时按文字替换，绝不执行代码。

密钥只填密钥栏。高级参数和命令配置属于普通设置，会随设置备份导出；不要直接在里面放密码、令牌或云密钥。认证头中用`{{apiKey}}`引用密钥栏。

## 本地程序与其他官方SDK

命令填写JSON数组，例如：

```json
["/绝对路径/venv/bin/python","/绝对路径/diffusers-image.py"]
```

首项必须是可执行文件绝对路径。提示词等数据从stdin读取，不拼进命令：

```json
{"prompt":"一只猫","size":"1024x1024","count":1,"model":"模型标识","options":{}}
```

程序在stdout只输出一份JSON：

```json
{"images":["图片Base64或HTTP(S)下载地址"]}
```

诊断写stderr；凭据可从`IMAGE_GENERATION_API_KEY`读取。示例[Diffusers程序](examples/diffusers-image.py)需要自行安装torch、diffusers、transformers、accelerate及该模型所需依赖，并具备足够GPU/内存/磁盘。程序每次启动会加载模型，长期使用可自行部署常驻HTTP服务并选自定义HTTP。AWS SigV4、腾讯TC3、百度OAuth及其他签名/刷新令牌流程由对应官方SDK程序处理，本插件不会假装Bearer认证能适配这些接口。

取消时Unix会终止进程组，必要时强制结束；Windows仅保证直接子进程终止。远端已提交任务可能仍运行，不能保证取消即退款。脚本由服务器业务账号运行，只配置自己信任的程序。

## 超时、结果与存储

- 每次默认生成1张，可设上限1–4张；部分服务逐张提交，分别计费。最多两个任务同时运行，超过时直接提示忙，不暗中排队或重试。
- 提交、轮询、下载共用超时，默认180秒；图片默认每张最多20MB。接口失败和空结果明确报错，不伪装成功。
- 图片下载不携带API密钥，不自动跟随重定向；认证轮询拒绝跨域地址。部分要求跨域认证或跳转的服务需使用同源网关或自己的SDK程序，不能据此声称全部厂商零配置可用。
- 超时/取消会停止本插件等待与下载；不保证提供商撤销已提交任务。部分成功时返回已有图片并提示失败，不自动再次提交以免重复扣费。
- 本地结果在`<DSH_HOME>/companion/generated-images`，文件私有权限，默认7天、最多100张，每次成功生成时清理。不是额外备份任务，不进入普通插件备份。
- 网页工具图片另由dsh附件服务持久保存，可能随主人原始会话及引用附件备份保存；插件结果目录的清理不删除dsh已持久化的附件。QQ消息存档按既有白名单策略，只记录生成图片的文字事件。
- 设置页图片、试画和下载API均要求现有dsh登录。仅返回图片元数据，不回显Key、本地文件路径、提示词或签名下载地址。

## 验证状态及参考

本版本对18种协议/程序模式做了模拟接口测试，覆盖请求形状、异步轮询、认证、图片下载、取消、错误、保留策略；真实dsh搭配模拟聊天模型与OneBot验证QQ图片发送、群聊权限、网页试画与登录保护。没有使用各家真实付费凭据逐一出图，不承诺任何模型、供应商、地域或私有API永久兼容。

协议参考：[魔搭模型API示例](https://www.modelscope.cn/models/Qwen/Qwen-Image-2.1)、[Gemini](https://ai.google.dev/gemini-api/docs/image-generation)、[BFL](https://docs.bfl.ai/quick_start/generating_images)、[fal队列](https://fal.ai/docs/documentation/model-apis/inference/queue)、[Replicate](https://replicate.com/docs/reference/http)、[Stability](https://platform.stability.ai/docs/api-reference)、[ComfyUI](https://docs.comfy.org/development/comfyui-server/comms_routes)、[HF](https://huggingface.co/docs/inference-providers/tasks/text-to-image)。
