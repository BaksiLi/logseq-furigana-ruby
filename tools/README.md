# Tools

Development and testing utilities for the logseq-furigana-ruby project.

## Available Tools

### `convert.js`
Converts files containing ruby annotation syntax between different formats.

```bash
# Convert to HTML
node tools/convert.js assets/logseq_inline_annotation.md

# Convert to markup format
node tools/convert.js input.txt --format markup --output output.md

# Convert to macro format with verbose output
node tools/convert.js test.md --format macro --verbose
```

**Formats:**
- `html` - Convert to HTML `<ruby>` tags (default)
- `markup` - Convert to `[base]^^(annotation)` syntax
- `macro` - Convert to Logseq `{{renderer :ruby, ...}}` format

### `generate-examples.js`
Generates HTML examples for documentation.

```bash
# Generate examples for README
node tools/generate-examples.js

# Generate markdown format
node tools/generate-examples.js markdown
```

## Usage in Tests

These tools are particularly useful for:
- Testing parser functionality
- Generating documentation examples
- Converting between formats for compatibility testing
- Validation of parser output

## Requirements

Make sure to build the project first:
```bash
pnpm run build
```

This creates the required `dist/parser.js` file that the tools depend on.