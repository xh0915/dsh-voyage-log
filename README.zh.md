# 航海日志 · Voyage Log

English | 中文

给 DeepSeek Harness 的一个标签页插件：**把一次 AI 会话，变成一份看得懂的航行报告。**

一次对话就是一次航行。你在 DSH 里跟 AI 干完一段活之后，往往说不清刚才到底发生了什么——它改了哪些文件、调了几次工具、哪一步失败了、一共花了多少 token。这些信息其实都在会话日志里，只是没人愿意去读那一大堆原始事件。航海日志替你读，然后整理成几页纸。

![航海日志标签页 · 界面设计稿](design/shots/01-voyage-light.png)

*界面设计稿，不是实机截图；实际渲染以安装后的 Harness 为准。*

## 安装后你会看到什么

任何有历史的对话，顶部都会多一个「航海日志」标签。点开是三块内容：

### 关键数字

这趟航行的成绩单：聊了多久、走了几轮、调用了几次工具、失败几次、改了哪些文件、读了多少文件、烧了多少 token（输入、输出、缓存读取分开算）。

所有数字都是从日志里数出来的，没有估算。也没有费用——会话日志本身不记录价格，插件不会编一个。

### 时间线

按时间顺序，一轮一轮地还原发生了什么：你说了什么、AI 回了什么、调用了哪个工具、耗时多久、结果是什么、是否失败、审批过没过、哪里重试、哪里压缩了上下文、这一轮是怎么结束的。

发了请求却始终没收到结果的工具调用，会明确标成"没有回执"，而不是悄悄消失。

### 文件、工具和模型

文件和工具各自的排行榜：哪些文件被改得最多、读得最多，哪些工具调用最多、失败最多，各个模型分别回复过多少次。

### 还能做什么

- **任务清单**：显示这次会话里最近一次写入的待办面板。
- **导出**：复制一段 Markdown 摘要，或者下载 / 打印成**一个 HTML 文件**——样式全部内联，不引用外部资源、不含脚本，发给谁都能直接打开。

## 隐私：它不会把你的密钥露出来

AI 会话里经常混着各种 key、token 和邮箱。所以它在"把内容交给界面"之前，先做一遍脱敏：

- 读取和整理**都在你本机完成**，不上传任何内容。
- 私钥块、JWT、GitHub / AWS / Google / Slack / npm / PyPI / Stripe / DeepSeek 形态的密钥、`Bearer` 认证头、URL 里的账号密码、`api_key = …` 赋值、邮箱，全部替换成 `«已脱敏»`。
- 报告里会写清楚：这次一共涂掉多少处、命中了哪些类别。
- 只是长得像密钥的东西不会被误伤：`process.env.X`、`${TEMPLATE}`、`foo.bar.baz`、全大写常量、很短的字符串，都会原样保留。
- 脱敏默认开启。如果你手动关掉，报告会明说"这次没有脱敏"，不会假装做过。

## 安装

需要 Node.js 22.19 或更高（24 也可以），以及 DeepSeek Harness 0.1.0-rc.6 或更高。

```sh
git clone https://github.com/xh0915/dsh-voyage-log
cd dsh-voyage-log
pnpm install
pnpm run build
dsh plugin --profile web add .
```

然后重启 Web Harness。随便打开一个聊过的对话，顶部就会出现这个标签。

**`pnpm run build` 必须在 `add` 之前跑。** 这个包没有安装期构建脚本（pnpm 10 会拦截未经批准的 `prepare`），跳过这一步，插件会"装上了却加载不出来"。

卸载：

```sh
dsh plugin --profile web remove dsh-voyage-log
```

## 可选设置

```yaml
dsh-voyage-log:
  redactSecrets: true   # 显示前先把密钥类内容涂掉，默认开启
  maxTurnEvents: 240    # 每一轮最多列几行，范围 20–5000
```

特别长的会话里，一轮可能超出预算：这时优先保留关键行，这一轮会被标成"已截断（capped）"，报告里也会写明——不会悄悄丢内容。

## 一些边界说明

- **没有费用数字**：日志里没有价格，插件不猜。
- **流式输出不逐字记录**：`*-chunks` 这类逐字增量事件会被忽略，只看真正描述过程的事件。
- **不额外抓取任何东西**：数据来自 Harness 自带的 `sessionQuery`，就是你自己本来就能看到的那个会话。
- 界面跟随 Harness 的明暗主题。

## 技术细节

<details>
<summary>改代码的人点这里</summary>

### 工程结构

```text
package.json           # dsh.bundle.patch + dsh.client、脚本、peer 依赖
cordis.patch.yml       # 把宿主插件行挂进 profile
dsh.plugin.json        # 注册表清单
src/index.ts           # 宿主入口：Config、Remote 服务、Typert 清单
src/runtime.ts         # voyage.build(sessionId)：读日志、整理、返回
src/fold.ts            # 整理引擎：原始事件 -> 轮次、行、汇总
src/redact.ts          # 本地脱敏
src/schema.ts          # Zod 线上契约（类型由此推导，不会漂移）
src/contract.ts        # 宿主与客户端共享的严格 InvocationDescriptor
src/typert.ts          # 宿主反射清单
src/client/index.tsx   # 客户端入口：挂 Remote、注册标签页
src/client/view.tsx    # 航海日志视图
src/client/report.ts   # Markdown 摘要 + 自包含 HTML 报告
src/client/styles.ts   # 主题令牌样式表（跟随 Harness 明暗）
src/client/locales.ts  # 中文 / 英文文案
tests/                 # 整理、脱敏、接口、报告单元测试
build.mjs              # esbuild 双构建：宿主 ESM + 客户端 CJS
```

客户端半边**不**贡献任何 prompt、工具或会话事件——`ctx.typert.register()` 只发布反射元数据。这个插件只是在你自己数据上加的一层界面。

### 开发

```sh
pnpm run check   # 类型检查 + lint + 测试 + 构建
```

### 改名

fork 后如果要改名，这些地方必须同步：`package.json` → `name`、`exports`、`files`；`build.mjs` → `__ModuleLoader__.load` 的 id；`src/index.ts` → `name`；`src/client/remote.ts` → 十六进制编码的 `TypertRemoteNamespace$…`；`src/client/locales.ts` → locale 命名空间；`src/client/index.tsx` → slot id；`src/typert.ts` → `package`；`src/contract.ts` → invocation id；`cordis.patch.yml` → `id` 与 `name`；`dsh.plugin.json` → `id`。

</details>

## 许可

MIT

作者：[里卡多 / xh0915](https://xh0915.github.io)
