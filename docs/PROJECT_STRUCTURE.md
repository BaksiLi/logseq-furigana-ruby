# Project Structure

```
logseq-furigana-ruby/
├── src/                          # Source code
│   ├── main.ts                   # Plugin main entry
│   ├── parser.ts                 # Ruby annotation parser
│   └── parser.test.ts            # Parser tests
├── assets/                       # Example files and resources
│   ├── logseq_inline_annotation.md  # Syntax examples
│   └── logseq_showcase.png       # Demo screenshot
├── tools/                        # Development utilities
│   ├── convert.js                # Format conversion tool
│   ├── generate-examples.js      # Documentation generator
│   └── README.md                 # Tools documentation
├── docs/                         # Documentation
│   └── MARKDOWN_IT_PLAN.md       # markdown-it plugin roadmap
├── dist/                         # Build output (gitignored)
├── demo.html                     # Live demo page
├── README.md                     # Main documentation
├── package.json                  # NPM configuration
└── tsconfig.json                 # TypeScript configuration
```

## Key Files

- **`src/parser.ts`** - Core parsing logic for ruby annotations
- **`demo.html`** - Interactive demo showcasing all features
- **`assets/logseq_inline_annotation.md`** - Comprehensive syntax examples
- **`tools/convert.js`** - CLI tool for format conversion
- **`docs/MARKDOWN_IT_PLAN.md`** - Roadmap for markdown-it plugin

## Build Process

1. **TypeScript compilation** - `src/*.ts` → `dist/*.js`
2. **Vite bundling** - Creates plugin bundle for Logseq
3. **Tool compilation** - Standalone parser for CLI tools

## Development Workflow

```bash
# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Use conversion tools
pnpm convert input.md --format html
pnpm examples
```
