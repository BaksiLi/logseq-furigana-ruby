# logseq-furigana-ruby

Logseq plugin for **Inline Annotation**: ruby/furigana, over/under glosses,
bouten, overlines, and underlines using `[base]^^(ruby)` and
`[base]^_(under)`.

![Inline Annotation showcase](./assets/logseq_showcase.png)

The portable grammar and `ia-*` HTML class contract live in the
[Inline Annotation spec](https://github.com/BaksiLi/markdown-it-inline-annotation/blob/main/SPEC.md).
This plugin keeps an independent parser plus Logseq-specific macros and
conversion commands.

## Syntax

| Input | Meaning |
| --- | --- |
| `[base]^^(ruby)` | ruby or gloss above |
| `[base]^_(gloss)` | ruby or gloss below |
| `base^^(ruby)` | abbreviated base |
| `[北京]^^(ペキン\|Beijing)` | annotation above and below |
| `[base]^^(over)^_(under)` | chained two-slot annotation |
| `[[護]^^(まも)れ]^_(プロテゴ)` | nested or overlapping annotation |
| `[春夏秋冬]^^(はる なつ あき ふゆ)` | per-character reading |
| `[漢字]^^(..)` | bouten above |
| `[漢字]^_(..)` | dotted emphasis below |
| `[base]^^(.-)` | solid overline |
| `[base]^_(.-)` | solid underline |
| `[base]^_(.~)` | wavy underline |
| `[base]^_(.=)` | double underline |

Escaped `\|`, `\)`, `\[`, and `\]` stay literal when the Logseq parser has not
already consumed the backslash. See the
[full showcase](./assets/logseq_inline_annotation.md) for copyable examples.

## Logseq Macros

Macros avoid conflicts with Logseq's own Markdown parser:

```text
{{renderer :ruby, 漢字, かんじ}}
{{renderer :ruby, base, under, under}}
{{renderer :ruby, 北京, ペキン|Beijing}}
```

The plugin provides three slash commands for the current or selected blocks:

- `Ruby → markup`: convert macros or generated HTML back to Inline Annotation source.
- `Ruby → macro`: convert source or generated HTML to editable Logseq macros.
- `Ruby → HTML (one-way)`: convert macros or source to portable rendered HTML.

Conversion protects inline and fenced code blocks.

## Host Limitations

Logseq parses a block before plugins see it. Several `^^(...)` expressions in
one bullet can therefore be interpreted as Logseq highlight syntax. This is a
host conflict, not part of the Inline Annotation grammar. Use macros or the
conversion commands when a block triggers it.

Logseq may also remove a backslash before the plugin runs, so a literal escaped
pipe can become a slot separator. Macro syntax is the reliable form for that
case.

For rendered DOM, the plugin may join adjacent plain text nodes or
attribute-free spans. It does not join across emphasis, highlight, links, code,
or other semantic elements, because doing so would discard Logseq decoration.
An expression fully contained inside one formatted run can still render.

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

The test suite runs the shared HTML corpus, shared segment-boundary fixtures,
Logseq conversion workflows, and parser-specific cases.

For manual installation:

1. Run `pnpm build`.
2. Enable Developer mode in Logseq under Settings → Advanced.
3. Choose Plugins → Load unpacked plugin and select this folder.

## Ecosystem

- [Inline Annotation spec and markdown-it package](https://github.com/BaksiLi/markdown-it-inline-annotation)
- [Inline Ruby Annotation for Obsidian](https://community.obsidian.md/plugins/inline-annotation)
- [Inline Annotation for VS Code](https://marketplace.visualstudio.com/items?itemName=baksili.vscode-inline-annotation)
- [Original proposal](https://blog.baksili.codes/markdown-ruby)

## License

MIT — Baksi Li
