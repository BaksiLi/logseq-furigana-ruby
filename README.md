# logseq-furigana-ruby

Logseq plugin for ruby/furigana using the `^^()` syntax from the [Markdown Ruby proposal](https://blog.baksili.codes/markdown-ruby).

## Syntax

Inline (one ruby per line):

- `[漢字]^^(かんじ)` / `東京^^(とうきょう)` — above
- `[base]^_(ruby)` — below
- `[北京]^^(ペキン|Beijing)` — 2 levels (above + below)
- `[base]^^(over)^_(under)` — mixed chain
- `[漢字]^^(..)` — bouten dots above
- `[漢字]^_(..)` – underdots
- `[base]^_(.-)` — underline

Macro (safe for multiple per line):

```
{{renderer :ruby, 漢字, かんじ}}
{{renderer :ruby, base, ann, under}}
{{renderer :ruby, 漢字, ..}}
```

## Known Limitations

> LLogseq parses its own markdown **before** plugins run, and there is currently [no markdown post‑processor API](https://discuss.logseq.com/t/plugin-api-how-to-modify-the-way-markdown-is-render/17313/5).

- **Multiple inline `^^()` / `^_()`** – conflicts with Logseq’s highlight (`^^text^^`) and italic (`_text_`).  
  Use one ruby per line or convert to macros/HTML with the slash commands.

- **`\|` inside annotations** – Logseq strips the backslash first, so `\|` becomes a bare `|` and is treated as a level separator.  
  Use macros or `&#124;` when you need a literal pipe.

- **Under-bouten downgraded** – `[漢字]^_(..)` and `[漢字]^^(..)^_(..)` render as **underline** or **dots + underline** (instead of true under‑side ruby), because Electron/WebKit clip `ruby-position: under` and `text-emphasis-position: under` in Logseq’s layout. This is a deliberate, semantics‑preserving fallback.

In practice, you can always bypass these issues by converting to **macro** or **HTML** using the slash commands.


## Conversion Commands

Three conversion targets — works on **selected blocks** or current block:

| Command | Description |
|---------|-------------|
| `/Ruby → markup` | Convert HTML / macros → `[base]^^(ann)` syntax |
| `/Ruby → macro` | Convert markup / HTML → `{{renderer :ruby, …}}` |
| `/Ruby → HTML` | Convert markup / macros → raw `<ruby>` HTML |

## Install

1. Download/clone this repo
2. Logseq: **Settings → Advanced → Developer mode**
3. **Plugins → Load unpacked plugin** → select this folder

## Development

```bash
pnpm install
pnpm dev      # HMR
pnpm test     # 46 tests
pnpm build    # dist/
```

## License

MIT — Baksi Li <<myself@baksili.codes>>
