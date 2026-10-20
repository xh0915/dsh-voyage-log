# dsh-voyage-log

[中文](README.zh.md) | English

**航海日志 · Voyage Log** — a dual-side [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that folds the real session log of the conversation you are looking into a navigable voyage: legs, tool calls, file cargo, token readings, and a self-contained HTML report.

Every number on screen is measured off the raw log. Nothing is estimated, nothing is uploaded.

## What you get

A **航海日志 / Voyage Log** tab in the conversation view ring, with:

- **Readings** — legs, steps, tool calls, failed calls, files changed and read, wall time, raw event count, and input / output / cache-read tokens. No cost figure: the log does not carry one.
- **Timeline** — one leg per turn, ordered by log `seq`: prompts, model replies, tool calls with duration and result, approvals with their outcome, retries, compactions, and how each leg ended. A tool call whose result never arrived is shown as such instead of silently disappearing.
- **Route / Cargo / Conditions** — files by edit, write, and read counts; tools by call and failure counts; models by reply count.
- **Task list** — the latest `todo/write` board of the session.
- **Export** — copy a Markdown digest, or download / print a single self-contained HTML report (inline stylesheet, no external assets, no scripts).

Streaming noise (`*-chunks`) is ignored by design; the fold reads the events that actually describe the voyage.

## Privacy model

- The host reads the session through Harness's own `sessionQuery` service, folds it **in the host process**, and only the folded report crosses to the browser.
- Redaction runs **before** the boundary: private key blocks, JWTs, GitHub / AWS / Google / Slack / npm / PyPI / Stripe / DeepSeek-style keys, `Bearer` headers, URL credentials, `api_key = …` assignments, and email addresses are replaced with `«已脱敏»`. The report states how many spans were masked and which families fired.
- Values that only look like secrets are left alone on purpose: `process.env.X`, `${TEMPLATE}`, `foo.bar.baz`, `ALL_CAPS_CONSTANTS`, and short strings.
- Environment references, template holes, and code are detected, not guessed — check the redaction note in the report if you export a session that carried credentials.
- Redaction is on by default. Turning it off is a config choice, and the report then says so instead of pretending.

## Install

Requires Node.js `>= 22.19` (or `>= 24`) and DeepSeek Harness `>= 0.1.0-rc.6`.

```sh
git clone https://github.com/xh0915/dsh-voyage-log
cd dsh-voyage-log
pnpm install
pnpm run build
dsh plugin --profile web add .
```

Restart the Web Harness. The tab appears in the session view ring of any conversation with history.

`pnpm run build` is required before `add`: this package ships no install-time build script (pnpm 10 blocks unapproved ones, and a blocked `prepare` is the usual reason a plugin install "succeeds" and then fails to load).

Remove it with:

```sh
dsh plugin --profile web remove dsh-voyage-log
```

## Config

`dsh` settings for this bundle, with the defaults:

```yaml
dsh-voyage-log:
  redactSecrets: true
  maxTurnEvents: 240
```

- `redactSecrets` — mask secret-shaped spans on the host before they reach the browser.
- `maxTurnEvents` — row budget per leg (20…5000). When a leg overflows, key rows are kept first, the leg is marked `capped`, and the report carries a truncation note. This is the wire-size guard for very long sessions.

## How it is built

```text
package.json           # dsh.bundle.patch + dsh.client, scripts, peer deps
cordis.patch.yml       # mounts the host plugin row into a profile
dsh.plugin.json        # registry manifest
src/index.ts           # host entry: Config schema, Remote service, Typert manifest
src/runtime.ts         # voyage.build(sessionId) — reads the log, folds, returns
src/fold.ts            # the fold engine: raw events -> legs, rows, aggregates
src/redact.ts          # local secret redaction
src/schema.ts          # Zod wire authority (types inferred, nothing drifts)
src/contract.ts        # strict InvocationDescriptor shared by host and client
src/typert.ts          # host reflection manifest
src/client/index.tsx   # client entry: mounts the Remote, registers the tab
src/client/view.tsx    # the voyage view
src/client/report.ts   # Markdown digest + self-contained HTML report
src/client/styles.ts   # theme-token stylesheet (follows Harness light/dark)
src/client/locales.ts  # zh / en copy
tests/                 # fold, redaction, contract, and report unit tests
build.mjs              # esbuild dual build: host ESM + client CJS
```

The client contributes **no** prompt, tool, or session event — `ctx.typert.register()` only publishes reflection metadata. The plugin is UI over your own data.

## Development

```sh
pnpm run check   # typecheck + lint + test + build
```

## Renaming

If you fork this and rename it, keep these in sync: `package.json` → `name`, `exports`, `files`; `build.mjs` → the `__ModuleLoader__.load` id; `src/index.ts` → `name`; `src/client/remote.ts` → the hex-encoded `TypertRemoteNamespace$…` name; `src/client/locales.ts` → the locale namespace; `src/client/index.tsx` → the slot id; `src/typert.ts` → `package`; `src/contract.ts` → the invocation id; `cordis.patch.yml` → `id` and `name`; `dsh.plugin.json` → `id`.

## License

MIT
