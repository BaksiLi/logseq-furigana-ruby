# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0]

### Changed

- Aligned the independent Logseq parser with Inline Annotation v2:
  - `.-`, `.~`, and `.=` are now symmetric line marks. In the over slot they
    render as overlines; in the under slot they render as underlines.
  - Pipe-saturated input such as `[a]^^(x|y)^_(z)` now leaves the chained
    overflow visible instead of silently consuming it.
- Refreshed the vendored shared HTML fixture corpus from
  `markdown-it-inline-annotation` 0.2.0.

## [0.5.1]

### Fixed

- Aligned parser with the shared host-neutral fixture corpus from
  [`markdown-it-inline-annotation`](https://github.com/BaksiLi/markdown-it-inline-annotation) 0.1.1:
  - Nested over-ruby inside an under-ruby now correctly sets `ruby-position:over`
    on the inner slot so both annotations render in the right position
    (e.g. `[[護]^^(まも)れ]^_(プロテゴ)`, `[李太白]^^(Lǐ Tài Bái|ㄌㄧˇ ㄊㄞˋ ㄅㄞˊ)`).
  - Expanded test coverage against the shared conformance corpus.

## [0.5.0]

### Changed

- **BREAKING (custom CSS only):** Migrated the emitted HTML class contract from the
  plugin-specific `ls-ruby-*` prefix to the canonical `ia-*` Inline Annotation
  contract, shared with [`markdown-it-inline-annotation`](https://github.com/BaksiLi/markdown-it-inline-annotation)
  and defined in the [Inline Annotation spec](https://github.com/BaksiLi/markdown-it-inline-annotation/blob/main/SPEC.md):
  - `ls-ruby` → `ia-ruby` (`ia-ruby-over` / `ia-ruby-under` / `ia-ruby-double` / `ia-ruby-mixed`)
  - `ls-ruby-bouten*` → `ia-bouten*`
  - `ls-ruby-underline*` → `ia-underline*`
  - Rendering behaviour is unchanged. Only users who wrote **custom theme CSS**
    targeting `.ls-ruby-*` selectors need to update them to `.ia-*`.

### Fixed

- Annotation-content detection for the `→ markup` / `→ macro` conversions no longer
  relied on a single shared substring; bouten- and underline-only spans
  (`ia-bouten` / `ia-underline`) are now reliably detected.

## [0.4.1]

- Previous release (see git history).
