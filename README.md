# 航海日志 · dsh-voyage-log

**一次 AI 会话干了多少活，它给你算成几页纸。**

**中文** · [English](README.en.md)

## 先看一个场景

你在 DeepSeek Harness 里跟 AI 干了一小时，活干完了。有人问你「刚才做了什么」，你答不上来。

想答上来，得去翻会话日志——那是几千行原始事件：`turn/start`、`tool/call`、`tool/result`、审批、重试、上下文压缩。没人会读那个东西。

**航海日志替你读完，整理成几页纸。** 打开任何一个聊过天的会话，点「航海日志」标签：这趟航行的成绩单、一轮一轮的时间线、文件和工具的排行榜，都在上面。想存档，一键导出成**一个 HTML 文件**或者一段 Markdown，发给谁都能直接打开。

所有数字都是从日志里数出来的，没有估算。

## 它能回答哪些问题

- 这次聊了多久、走了几轮、调了几次工具、失败几次。
- 哪个文件被改得最多、哪个文件被读了很多次却没改。
- 哪个工具调用最多、哪个失败最多。
- 哪一轮最耗时，慢在哪个工具上。
- 用了多少 token（输入、输出、缓存读取分开算）。
- 哪一步发了请求却始终没收到结果——这种会明确标成「没有回执」，不会悄悄消失。

## 长这样

![航海日志标签页 · 界面设计稿](https://testingcf.jsdelivr.net/gh/xh0915/dsh-voyage-log@4522dd9/design/shots/01-voyage-light.png)

> 上面是界面设计稿，不是实机截图；实际渲染以安装后的 Harness 为准。

导出之后拿到的那份报告，是插件真的生成出来的东西：

![导出的单文件航行报告](https://testingcf.jsdelivr.net/gh/xh0915/dsh-voyage-log@4522dd9/design/shots/04-exported-report.png)

> 一份真实导出的报告：样式全部内联，不引用外部资源、不含脚本，双击就能打开，也能直接打印。

时间线部分，每一轮大概长这样：

```text
第 4 轮 · 14:37 · 1 分 14 秒
你    tokens.css 建成四层令牌，结构别动。
AI    先读现有样式，再建令牌文件。
      工具 read   src/styles/tokens.css        0.4s   成功
      工具 edit   src/styles/tokens.css        1.1s   成功
      工具 bash   npm run build                  48s   失败：--ink-soft 未定义
      工具 edit   src/styles/tokens.css         0.9s   成功
      工具 bash   npm run build                  51s   成功
结束  正常回复
```

> 排版示意：字段和真实页面一致，具体耗时是编的，事件本身取自上面那份示例会话。

## 页面上有什么

**关键数字** —— 聊了多久、走了几轮、调用了几次工具、失败几次、改了哪些文件、读了多少文件、烧了多少 token。没有费用数字：会话日志本身不记录价格，插件不会编一个。

**时间线** —— 按时间顺序一轮一轮还原：你说了什么、AI 回了什么、调用了哪个工具、耗时多久、结果是什么、是否失败、审批过没过、哪里重试、哪里压缩了上下文、这一轮怎么结束的。

**文件、工具和模型** —— 三张排行榜：哪些文件被改得最多、读得最多，哪些工具调用最多、失败最多，各个模型分别回复过多少次。

**任务清单** —— 显示这次会话里最近一次写入的待办面板。

**导出** —— 复制一段 Markdown 摘要，或者下载 / 打印成一个 HTML 文件。那个文件是自包含的：样式内联、不引用外部资源、不含脚本，可以直接归档或者转给别人。

## 怎么装

需要 Node.js 22.19 或更高（24 也可以），以及 DeepSeek Harness 0.1.0-rc.6 或更高。

```sh
git clone https://github.com/xh0915/dsh-voyage-log
cd dsh-voyage-log
pnpm install
pnpm run build
dsh plugin --profile web add .
```

然后重启 Web Harness。随便打开一个聊过的对话，顶部就会出现「航海日志」标签，点进去就是这次的报告。

> **`pnpm run build` 必须在 `add` 之前跑。** 这个包没有安装期构建脚本（pnpm 10 会拦下未批准的 `prepare`），跳过这一步，插件会「装上了却加载不出来」。

卸载：

```sh
dsh plugin --profile web remove dsh-voyage-log
```

## 它不会做的事

- **不猜费用。** 日志里没有价格，就不给价格。
- **不逐字记录流式输出。** `*-chunks` 这类增量事件会被忽略，只看真正描述过程的事件——否则一份报告会大到没法看。
- **不多抓一个字节。** 数据来自 Harness 自带的 `sessionQuery`，就是你自己本来就能看到的那个会话。
- **不上传任何东西。** 读取、整理、生成报告全在你本机完成。
- **不丢内容也不吭声。** 特别长的会话里某一轮超出预算时，会优先保留关键行，并把这一轮标成「已截断」，报告里同样写明。

## 隐私

AI 会话里经常混着各种 key、token 和邮箱，所以它在「把内容交给界面」之前先做一遍脱敏：

- 私钥块、JWT、GitHub / AWS / Google / Slack / npm / PyPI / Stripe / DeepSeek 形态的密钥、`Bearer` 认证头、URL 里的账号密码、`api_key = …` 赋值、邮箱，全部替换成 `«已脱敏»`。
- 报告里会写清楚：这次一共涂掉多少处、命中了哪些类别。
- 只是长得像密钥的东西不会被误伤：`process.env.X`、`${TEMPLATE}`、`foo.bar.baz`、全大写常量、很短的字符串，都原样保留。
- 脱敏默认开启。如果你手动关掉，报告会明说「这次没有脱敏」，不会假装做过。

## 设置

```yaml
dsh-voyage-log:
  redactSecrets: true   # 显示前先把密钥类内容涂掉，默认开启
  maxTurnEvents: 240    # 每一轮最多列几行，范围 20–5000
```

界面跟随 Harness 的明暗主题。

<details>
<summary><b>技术细节（要改代码的人点这里）</b></summary>

### 目录

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

fork 后要改名的话，这些地方必须同步：`package.json` → `name`、`exports`、`files`；`build.mjs` → `__ModuleLoader__.load` 的 id；`src/index.ts` → `name`；`src/client/remote.ts` → 十六进制编码的 `TypertRemoteNamespace$…`；`src/client/locales.ts` → locale 命名空间；`src/client/index.tsx` → slot id；`src/typert.ts` → `package`；`src/contract.ts` → invocation id；`cordis.patch.yml` → `id` 与 `name`；`dsh.plugin.json` → `id`。

</details>

## 许可证

MIT

作者：[里卡多 / xh0915](https://xh0915.github.io)
