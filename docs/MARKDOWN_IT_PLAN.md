# Markdown-it Ruby Plugin 開發計劃

## 目標

創建一個標準的 `markdown-it-ruby` 插件，讓 `[base]^^(annotation)` / `[base]^_(annotation)` 語法能在任何支持 markdown-it 的環境中使用。

## 項目結構

```
markdown-it-ruby/
├── src/
│   ├── index.ts                 # 主插件入口
│   ├── parser.ts               # 從 logseq-furigana-ruby 移植的解析邏輯
│   ├── tokenizer.ts            # markdown-it token 處理
│   └── renderer.ts             # HTML 渲染器
├── test/
│   ├── fixtures/               # 測試用例
│   └── index.test.ts           # 單元測試
├── dist/                       # 編譯輸出
├── package.json
├── README.md
└── tsconfig.json
```

## 階段規劃

### 階段 1：核心功能移植 (1-2週)

#### 1.1 項目設置
- [ ] 創建新的 npm 包 `markdown-it-ruby`
- [ ] 設置 TypeScript 構建環境
- [ ] 配置測試框架 (Jest/Vitest)
- [ ] 設置 CI/CD (GitHub Actions)

#### 1.2 解析器移植
- [ ] 從 `logseq-furigana-ruby/src/parser.ts` 提取核心邏輯
- [ ] 移除 Logseq 特定的代碼（DOM 操作、宏渲染等）
- [ ] 保留核心解析功能：
  - `rubyToHTML()` - 核心轉換函數
  - `hasRuby()` - 檢測函數
  - 所有特殊模式處理（bouten、underline、多層等）

#### 1.3 Markdown-it 集成
```typescript
// src/index.ts
import MarkdownIt from 'markdown-it'
import { rubyToHTML, hasRuby } from './parser'

function markdownItRuby(md: MarkdownIt, options = {}) {
  // 註冊內聯規則，在 emphasis 之前處理
  md.inline.ruler.before('emphasis', 'ruby', rubyRule, {
    alt: ['paragraph', 'reference', 'autolink']
  })
  
  // 註冊渲染器
  md.renderer.rules.ruby_open = rubyRenderOpen
  md.renderer.rules.ruby_close = rubyRenderClose
  md.renderer.rules.ruby_text = rubyRenderText
}

function rubyRule(state: StateInline, start: number, max: number, silent: boolean) {
  // 檢測 ^^ 或 ^_ 模式
  // 解析 [base]^^(annotation) 語法
  // 創建 tokens
}
```

### 階段 2：功能完善 (1週)

#### 2.1 選項配置
```typescript
interface RubyOptions {
  // CSS 類名前綴
  classPrefix: string        // 默認 'ruby'
  
  // 內聯樣式選項
  inlineStyles: boolean      // 默認 true（為了跨環境兼容性）
  
  // 特殊模式開關
  enableBouten: boolean      // 默認 true
  enableUnderline: boolean   // 默認 true
  
  // 字元對齊選項  
  enableAlignment: boolean   // 默認 true
  enableAutoHide: boolean    // 默認 true
}
```

#### 2.2 CSS 輸出選項
```typescript
// 可選擇是否包含內聯樣式
const md = new MarkdownIt()
  .use(markdownItRuby, {
    inlineStyles: false,  // 使用外部 CSS
    classPrefix: 'my-ruby'
  })

// 提供 CSS 導出函數
import { generateCSS } from 'markdown-it-ruby/css'
const css = generateCSS({ prefix: 'my-ruby' })
```

### 階段 3：生態系統擴展 (2-3週)

#### 3.1 多平台支持包
```
@markdown-it-ruby/
├── core                    # 核心包
├── vscode                  # VS Code 擴展
├── obsidian               # Obsidian 插件  
├── typora                 # Typora 主題
└── gatsby                 # Gatsby 插件
```

#### 3.2 工具鏈集成
- [ ] **Webpack loader**: `ruby-loader`
- [ ] **Rollup plugin**: `rollup-plugin-ruby`
- [ ] **Vite plugin**: `vite-plugin-ruby`
- [ ] **Astro integration**: `@astrojs/ruby`

### 階段 4：進階特性 (1-2週)

#### 4.1 語法擴展
```markdown
<!-- 支持更多語法糖 -->
漢字^^かんじ              # 簡化語法（可選）
漢字^^(かんじ){.important} # 附加 CSS 類
漢字^^(かんじ)[title]      # 添加 title 屬性
```

#### 4.2 互操作性
```typescript
// 與現有 Logseq 插件的兼容層
import { logseqCompat } from 'markdown-it-ruby/compat'

const md = new MarkdownIt()
  .use(markdownItRuby)
  .use(logseqCompat)  // 支持宏語法轉換
```

## 技術細節

### Token 設計
```typescript
interface RubyToken {
  type: 'ruby_open' | 'ruby_close' | 'ruby_text'
  tag: 'ruby' | 'rt' | 'rp' | 'span'
  content: string
  attrSet: (name: string, value: string) => void
  meta: {
    base: string
    annotations: string[]
    position: 'over' | 'under' | 'both'
    special: 'bouten' | 'underline' | null
    aligned: boolean
  }
}
```

### 優先級處理
```typescript
// 確保 ruby 語法不與其他插件衝突
md.inline.ruler.before('emphasis', 'ruby', rubyRule)
md.inline.ruler.before('strikethrough', 'ruby', rubyRule)
```

## 測試策略

### 單元測試
```typescript
// test/index.test.ts
describe('markdown-it-ruby', () => {
  test('basic ruby annotation', () => {
    const result = md.render('[漢字]^^(かんじ)')
    expect(result).toContain('<ruby class="ruby ruby-over">')
  })
  
  test('per-character alignment', () => {
    const result = md.render('[春夏]^^(はる なつ)')
    expect(result).toMatch(/春.*はる.*夏.*なつ/)
  })
  
  test('special patterns', () => {
    expect(md.render('重要^^(..)'))
      .toContain('ls-ruby-bouten')
  })
})
```

### 兼容性測試
- 測試與常見 markdown-it 插件的兼容性
- 測試不同瀏覽器的渲染效果
- 測試性能（大文檔處理）

## 發布計劃

### NPM 發布
```json
{
  "name": "markdown-it-ruby",
  "version": "1.0.0",
  "keywords": ["markdown-it", "ruby", "furigana", "annotation"],
  "peerDependencies": {
    "markdown-it": "^13.0.0"
  }
}
```

### 文檔網站
- 使用 VitePress 創建文檔網站
- 集成實時預覽功能
- 提供所有範例的互動演示

## 回饋到現有項目

### Logseq 插件重構
```typescript
// 更新 logseq-furigana-ruby 使用新的核心包
import { rubyToHTML, anyToHTML } from 'markdown-it-ruby/core'

// 保持現有 API 不變，但使用共享的解析邏輯
```

### 版本策略
- 核心解析邏輯版本同步
- 向後兼容保證
- 漸進式遷移路徑

## 預期效益

1. **標準化**: 讓 ruby 語法成為 Markdown 生態系統的標準之一
2. **可移植性**: 代碼可在任何 markdown-it 環境中使用
3. **維護性**: 單一核心，多平台復用
4. **社群**: 吸引更多開發者參與和貢獻

## 風險評估

### 技術風險
- **性能**: 複雜的解析邏輯可能影響渲染速度
- **兼容性**: 與其他 markdown-it 插件的衝突

### 解決方案
- 使用 benchmark 測試優化性能
- 提供插件優先級配置
- 編寫詳細的兼容性指南

---

你覺得這個計劃如何？我們可以先從核心功能移植開始，這樣你現有的工作就能立即受益，而不是變得徒勞無功。