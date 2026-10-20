/**
 * dsh-voyage-log client stylesheet.
 *
 * Colors ride the DeepSeek `--dsw-*` theme tokens with bright blue-white
 * fallbacks, and the dark branch keys off `body[data-ds-dark-theme]`, so the
 * view follows whichever theme the shell resolved. No glows, no neon — ink on
 * ice, with the DeepSeek blue as the only accent.
 */
const STYLE_ID = 'dsh-voyage-log-styles'

const CSS = `
.v-root{--v-bg:var(--dsw-alias-bg-layer-2,#f3f8fe);--v-deep:var(--dsw-alias-bg-base,#eaf2fc);--v-surface:var(--dsw-alias-bg-layer-1,#fff);--v-line:var(--dsw-alias-border-l1,#e4eef9);--v-line-2:var(--dsw-alias-border-l2,#d6e4f5);--v-ink:var(--dsw-alias-label-primary,#0b2347);--v-ink-2:var(--dsw-alias-label-secondary,#334f75);--v-ink-3:var(--dsw-alias-label-tertiary,#607a9d);--v-blue:var(--dsw-alias-brand-primary,#3d5af1);--v-blue-soft:var(--dsw-alias-button-info-fill,#eaf1ff);--v-green:var(--dsw-alias-state-success-primary,#0b8a68);--v-amber:var(--dsw-alias-state-warn-primary,#a96c17);--v-rose:var(--dsw-alias-state-error-primary,#b05a64);
position:relative;min-height:100%;background:linear-gradient(180deg,var(--v-deep),var(--v-bg));color:var(--v-ink);font:13px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
body[data-ds-dark-theme] .v-root{--v-ink:var(--dsw-alias-label-primary,#e9f2fd);--v-ink-2:var(--dsw-alias-label-secondary,#b6cee8);--v-ink-3:var(--dsw-alias-label-tertiary,#89a8cb);--v-surface:var(--dsw-alias-bg-layer-1,#12233a);--v-line:var(--dsw-alias-border-l1,#1c3554);--v-line-2:var(--dsw-alias-border-l2,#24446b);--v-blue:var(--dsw-alias-brand-primary,#8ea4ff);--v-blue-soft:var(--dsw-alias-button-info-fill,#16294a);--v-green:var(--dsw-alias-state-success-primary,#5fd3ad);--v-amber:var(--dsw-alias-state-warn-primary,#e3b46b);--v-rose:var(--dsw-alias-state-error-primary,#f0a3ac)}
.v-inner{max-width:1180px;margin:0 auto;padding:16px 18px 40px}
.v-bar{position:sticky;top:0;z-index:3;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;background:linear-gradient(180deg,var(--v-bg) 72%,transparent);backdrop-filter:blur(2px)}
.v-hero{display:flex;gap:12px;align-items:flex-start;margin:2px 0 14px}
.v-mark{flex:none;color:var(--v-blue);margin-top:3px}
.v-hero h2{margin:0;font-size:17px;font-weight:600;letter-spacing:.2px}
.v-hero .v-sub{margin:3px 0 0;color:var(--v-ink-3);font-size:11.5px;word-break:break-all}
.v-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
.v-chip{padding:2px 9px;border-radius:999px;background:var(--v-blue-soft);color:var(--v-blue);font-size:11.5px}
.v-chip.warn{background:color-mix(in srgb,var(--v-amber) 14%,transparent);color:var(--v-amber)}
.v-chip.bad{background:color-mix(in srgb,var(--v-rose) 14%,transparent);color:var(--v-rose)}
.v-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border:1px solid var(--v-line-2);border-radius:9px;background:var(--v-surface);color:var(--v-ink-2);font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,color .15s,transform .1s}
.v-btn:hover{border-color:var(--v-blue);color:var(--v-blue)}
.v-btn:active{transform:translateY(1px)}
.v-btn.primary{background:var(--v-blue);border-color:var(--v-blue);color:#fff}
.v-btn.primary:hover{color:#fff;filter:brightness(1.06)}
.v-btn[disabled]{opacity:.5;cursor:default}
.v-spacer{flex:1 1 24px}
.v-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:9px;margin:4px 0 16px}
.v-cell{padding:10px 12px;background:var(--v-surface);border:1px solid var(--v-line);border-radius:12px}
.v-cell b{display:block;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
.v-cell span{color:var(--v-ink-3);font-size:11px}
.v-cell.bad b{color:var(--v-rose)}
.v-cols{display:grid;grid-template-columns:minmax(0,1fr) 316px;gap:16px;align-items:start}
@media (max-width:960px){.v-cols{grid-template-columns:minmax(0,1fr)}}
.v-h{margin:0 0 9px;font-size:13px;font-weight:600;color:var(--v-ink-2)}
.v-filters{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}
.v-flabel{color:var(--v-ink-3);font-size:11.5px}
.v-toggle{padding:3px 10px;border-radius:999px;border:1px solid var(--v-line-2);background:transparent;color:var(--v-ink-3);font:inherit;font-size:11.5px;cursor:pointer}
.v-toggle[aria-pressed="true"]{background:var(--v-blue-soft);border-color:transparent;color:var(--v-blue)}
.v-leg{background:var(--v-surface);border:1px solid var(--v-line);border-radius:13px;margin-bottom:10px;overflow:hidden}
.v-leg-h{display:flex;gap:9px;align-items:baseline;width:100%;padding:10px 13px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left}
.v-leg-h:hover{background:var(--v-blue-soft)}
.v-leg-t{font-weight:600;font-size:12.5px}
.v-leg-m{color:var(--v-ink-3);font-size:11px}
.v-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--v-green);align-self:center}
.v-dot.open{background:var(--v-blue)}
.v-dot.error{background:var(--v-rose)}
.v-dot.aborted{background:var(--v-amber)}
.v-caret{margin-left:auto;color:var(--v-ink-3);font-size:11px}
.v-rows{padding:0 13px 11px}
.v-row{display:flex;gap:9px;padding:7px 0;border-top:1px dashed var(--v-line);align-items:baseline}
.v-time{flex:none;width:62px;color:var(--v-ink-3);font-size:10.5px;font-variant-numeric:tabular-nums}
.v-tag{flex:none;padding:1px 7px;border-radius:999px;background:var(--v-blue-soft);color:var(--v-blue);font-size:10.5px}
.v-tag.tool,.v-tag.file{background:color-mix(in srgb,var(--v-ink-2) 12%,transparent);color:var(--v-ink-2)}
.v-tag.retry,.v-tag.approval{background:color-mix(in srgb,var(--v-amber) 16%,transparent);color:var(--v-amber)}
.v-tag.turn-end{background:color-mix(in srgb,var(--v-green) 14%,transparent);color:var(--v-green)}
.v-tag.user{background:transparent;border:1px solid var(--v-line-2);color:var(--v-ink-3)}
.v-body{min-width:0;flex:1}
.v-main{white-space:pre-wrap;word-break:break-word}
.v-main.dim{color:var(--v-ink-2)}
.v-sub{display:block;color:var(--v-ink-3);font-size:11px;word-break:break-all}
.v-err{display:block;color:var(--v-rose);font-size:11.5px}
.v-note{margin:6px 0 0;font-size:11px;color:var(--v-amber)}
.v-panel{background:var(--v-surface);border:1px solid var(--v-line);border-radius:13px;padding:12px 13px;margin-bottom:12px}
.v-list{list-style:none;margin:0;padding:0}
.v-list li{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--v-line);font-size:11.5px}
.v-list li:first-child{border-top:0}
.v-p{word-break:break-all;color:var(--v-ink-2)}
.v-n{flex:none;color:var(--v-ink-3);font-variant-numeric:tabular-nums}
.v-bar-row{display:flex;gap:8px;align-items:center;font-size:11.5px;padding:5px 0;border-top:1px solid var(--v-line)}
.v-bar-row:first-child{border-top:0}
.v-track{flex:1;height:5px;border-radius:999px;background:var(--v-line);overflow:hidden}
.v-fill{height:100%;background:var(--v-blue);border-radius:999px}
.v-empty{padding:26px 14px;text-align:center;color:var(--v-ink-3);background:var(--v-surface);border:1px dashed var(--v-line-2);border-radius:13px}
.v-state{display:flex;gap:10px;align-items:center;padding:22px 14px;color:var(--v-ink-3)}
.v-spin{width:14px;height:14px;border:2px solid var(--v-line-2);border-top-color:var(--v-blue);border-radius:50%;animation:v-spin .8s linear infinite}
@keyframes v-spin{to{transform:rotate(360deg)}}
.v-veil{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px;background:color-mix(in srgb,var(--v-ink) 28%,transparent)}
.v-modal{width:min(460px,100%);background:var(--v-surface);border:1px solid var(--v-line-2);border-radius:16px;padding:18px;box-shadow:0 18px 44px -22px color-mix(in srgb,var(--v-ink) 55%,transparent)}
.v-modal h3{margin:0 0 4px;font-size:15px}
.v-modal p.hint{margin:0 0 14px;color:var(--v-ink-3);font-size:11.5px}
.v-field{margin:0 0 12px}
.v-field>.v-flabel{display:block;margin-bottom:6px;font-size:11.5px;color:var(--v-ink-3)}
.v-seg{display:flex;gap:6px}
.v-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:6px}
.v-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:50;padding:7px 14px;border-radius:999px;background:var(--v-ink);color:var(--v-surface);font-size:12px}
.v-local{margin:2px 0 0;color:var(--v-ink-3);font-size:10.5px}
`

/** Inject the view stylesheet once. */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
