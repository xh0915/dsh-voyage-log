# dsh-voyage-log

English | [中文](README.zh.md)

**航海日志 · Voyage Log** —— 一个双端 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件。它把你正在看的这次会话的真实日志折成一趟可以读的航行：航段、工具调用、文件货物、token 读数，并能导出一份自包含的 HTML 报告。

屏幕上每个数字都来自原始日志实测。不估算，不上传。

## 你能看到什么

会话视图环里多出一个 **航海日志** 标签页：

- **仪表读数** —— 航段、步骤、工具调用、失败调用、改动文件、读取文件、航行时长、原始事件数，以及输入 / 输出 / 缓存读取 token。没有费用：日志里本来就没有费用。
- **航迹时间线** —— 一个 turn 一个航段，按日志 `seq` 排列：指令、复命、带耗时与回执的工具调用、带结果的审批、模型重试、上下文压缩，以及每个航段的收场方式。发了却没收到回执的调用会如实标注，而不是悄悄消失。
- **航线 / 货物 / 海况** —— 文件按编辑、写入、读取计数；工具按调用与失败计数；模型按复命条数。
- **任务清单** —— 这次会话最近一次 `todo/write` 的面板。
- **导出** —— 复制一份 Markdown 摘要，或下载 / 打印一份单文件 HTML 报告（内联样式表，无外部资源，无脚本）。

流式噪声（`*-chunks`）按设计忽略；折叠只读真正描述这趟航行的事件。

## 隐私模型

- 宿主侧通过 Harness 自己的 `sessionQuery` 服务读取会话，**在宿主进程里**完成折叠，只有折叠后的报告跨过边界进入浏览器。
- 脱敏发生在跨界**之前**：私钥块、JWT、GitHub / AWS / Google / Slack / npm / PyPI / Stripe / DeepSeek 形态的密钥、`Bearer` 头、URL 内嵌账号密码、`api_key = …` 赋值、邮箱，一律替换成 `«已脱敏»`。报告会写明脱敏了多少处、命中哪些类别。
- 有意放过「只是长得像密钥」的内容：`process.env.X`、`${TEMPLATE}`、`foo.bar.baz`、`ALL_CAPS_CONSTANTS`、以及过短的字符串。
- 这些判断是识别，不是猜测。导出的会话如果原本携带凭据，请看一眼报告里的脱敏说明。
- 脱敏默认开启。关闭它是配置选择，报告会如实说「已关闭」，而不是装作做过。

## 安装

需要 Node.js `>= 22.19`（或 `>= 24`）与 DeepSeek Harness `>= 0.1.0-rc.6`。

```sh
git clone https://github.com/xh0915/dsh-voyage-log
cd dsh-voyage-log
pnpm install
pnpm run build
dsh plugin --profile web add .
```

重启 Web Harness。任何有历史的会话，视图环里都会出现这个标签页。

`add` 之前必须先 `pnpm run build`：本包不提供安装期构建脚本（pnpm 10 会拦截未批准的脚本，而插件「装成功却加载失败」通常就是 `prepare` 被拦下了）。

卸载：

```sh
dsh plugin --profile web remove dsh-voyage-log
```

## 配置

本 bundle 的 `dsh` 设置与默认值：

```yaml
dsh-voyage-log:
  redactSecrets: true
  maxTurnEvents: 240
```

- `redactSecrets` —— 在宿主侧、进入浏览器之前脱敏。
- `maxTurnEvents` —— 单个航段的行数预算（20…5000）。超限时优先保留关键行，航段标记 `capped`，报告附上截断说明。这是长会话的线上体积护栏。

## 工程结构

```text
package.json           # dsh.bundle.patch + dsh.client、脚本、peer 依赖
cordis.patch.yml       # 把宿主插件行挂进 profile
dsh.plugin.json        # 注册表清单
src/index.ts           # 宿主入口：Config、Remote 服务、Typert 清单
src/runtime.ts         # voyage.build(sessionId)：读日志、折叠、返回
src/fold.ts            # 折叠引擎：原始事件 -> 航段、行、聚合
src/redact.ts          # 本地脱敏
src/schema.ts          # Zod 线上契约（类型由此推导，不会漂移）
src/contract.ts        # 宿主与客户端共享的严格 InvocationDescriptor
src/typert.ts          # 宿主反射清单
src/client/index.tsx   # 客户端入口：挂 Remote、注册标签页
src/client/view.tsx    # 航海日志视图
src/client/report.ts   # Markdown 摘要 + 自包含 HTML 报告
src/client/styles.ts   # 主题令牌样式表（跟随 Harness 明暗）
src/client/locales.ts  # 中文 / 英文文案
tests/                 # 折叠、脱敏、契约、报告单元测试
build.mjs              # esbuild 双构建：宿主 ESM + 客户端 CJS
```

客户端半边**不**贡献任何 prompt、工具或会话事件——`ctx.typert.register()` 只发布反射元数据。这个插件只是在你自己的数据上面加了一层界面。

## 开发

```sh
pnpm run check   # 类型检查 + lint + 测试 + 构建
```

## 改名

fork 后如果要改名，这些地方必须同步：`package.json` → `name`、`exports`、`files`；`build.mjs` → `__ModuleLoader__.load` 的 id；`src/index.ts` → `name`；`src/client/remote.ts` → 十六进制编码的 `TypertRemoteNamespace$…`；`src/client/locales.ts` → locale 命名空间；`src/client/index.tsx` → slot id；`src/typert.ts` → `package`；`src/contract.ts` → invocation id；`cordis.patch.yml` → `id` 与 `name`；`dsh.plugin.json` → `id`。

## 许可

MIT
