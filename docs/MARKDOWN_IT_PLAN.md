# Inline Annotation Roadmap

## Goal

Build **Inline Annotation** as a portable Markdown extension, not only a Logseq plugin.

Spec title:

> Markdown Inline Annotation Extension: A syntax specification for ruby, text emphasis, and complex text decorations.

The Logseq plugin is the reference implementation for the current feature set. The next implementation order is:

1. `markdown-it-inline-annotation`
2. Logseq polish
3. Obsidian plugin
4. remark/unified support

Remark/unified is intentionally later because it is not an immediate use case, but the spec and tests should avoid choices that would make a future micromark/remark adapter awkward.

## Phase 1: markdown-it + Core

Replace the early `markdown-it-ruby-syntax` implementation with a new package named `markdown-it-inline-annotation`.

Package shape:

```text
src/
  core.ts       # parser, source-range model, safe HTML renderer
  index.ts      # markdown-it adapter
test.js         # conformance + markdown-it integration tests
SPEC.md         # normative behavior
README.md       # user docs
```

Core syntax:

- `[base]^^(annotation)` and `[base]^_(annotation)`
- `base^^(annotation)` and `base^_(annotation)` abbreviated form
- `[base]^^(over|under)` as compact two-slot notation
- `[base]^^(over)^_(under)` and reverse mixed chaining
- per-character alignment when space-separated annotation counts match base characters
- auto-hide matching base/annotation characters
- nested bracket spans such as `[[護]^^(まも)れ]^_(プロテゴ)`
- bouten modifier `..`
- underline modifiers `.-`, `.~`, `.=`

Core design:

- `^^` and `^_` are position-assignment operators for over/under slots.
- Normal slot text renders as ruby.
- Special slot values render as decoration modifiers.
- v1 capacity is two slots. Additional pipe levels are ignored for compatibility with the Logseq implementation.
- Output must escape user text before producing HTML.
- The parser must preserve source ranges so other adapters can later map source text to AST nodes.

markdown-it design:

- Register an inline rule before `text`, so abbreviated forms and multiple annotations in one paragraph can be found before markdown-it collapses them into text tokens.
- Do not override `renderer.rules.text`.
- Stop scanning before Markdown constructs such as code spans, links, emphasis, raw HTML, and entities so markdown-it can parse them normally.
- Emit portable HTML from core in v1; a semantic token renderer can be added after the grammar stabilizes.

## Phase 2: Logseq Polish

Keep the existing Logseq plugin behavior stable, then improve it using the lessons from the markdown-it port.

Priorities:

- Document Logseq's host limitation clearly: multiple inline `^^()` / `^_()` in one bullet can be parsed as Logseq highlight/italic before the plugin runs.
- Keep macro and HTML conversion as the recommended workaround.
- Optionally add a setting or command that converts selected inline markup to macro/HTML before Logseq's parser can conflict.
- Consider adopting the shared core after markdown-it has proven the parser and tests.

Do not try to make the Logseq host behave like a real Markdown postprocessor unless Logseq exposes a suitable API.

## Phase 3: Obsidian

Build an Obsidian plugin after markdown-it is stable.

First version:

- reading-view postprocessor using the shared core
- CSS for ruby, bouten, and underline modifiers
- no Live Preview guarantee in v1

Later:

- Live Preview/editor support if Obsidian APIs make it reliable
- optional conversion commands similar to Logseq

## Phase 4: remark/unified

Support the unified ecosystem when there is a concrete use case.

Target package family:

- `micromark-extension-inline-annotation`
- `mdast-util-inline-annotation`
- `remark-inline-annotation`

Compatibility constraints to keep in mind now:

- syntax must be expressible as a real inline tokenizer, not a post-render replacement
- source ranges should remain available
- HTML rendering should be separate from parse semantics
- fixtures should be reusable across markdown-it and future remark tests

## Test Strategy

Maintain shared fixtures that cover:

- basic over/under ruby
- abbreviated syntax
- pipe two-slot notation
- mixed chaining and same-operator non-chaining
- per-character alignment and auto-hide
- nested bracket spans
- bouten and underline modifiers
- escaped `|`, `)`, `]`, and backslash
- multiple annotations in one paragraph
- code span, link, emphasis, HTML, and entity interactions
- XSS escaping in base and annotation text

Acceptance for phase 1:

- `npm test` passes for core and markdown-it integration cases
- `npm run build` exits successfully
- old escaped-pipe failure is fixed
- markdown-it can render two or more annotations in one paragraph without relying on Logseq workarounds

## Naming

- Brand: **Inline Annotation**
- markdown-it package: `markdown-it-inline-annotation`
- future shared package name: `@inline-annotation/core`
- canonical spelling in code/docs: `bouten`
