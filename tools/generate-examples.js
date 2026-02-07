#!/usr/bin/env node

/**
 * README Examples Generator
 * 
 * Generates HTML examples for README documentation.
 * Used to maintain consistency between syntax examples and their rendered output.
 */

const { anyToHTML } = require('../dist/parser.js');

const examples = [
  // Basic Ruby
  { syntax: '[base]^^(ruby)', section: 'Basic Ruby - Above' },
  { syntax: '[base]^_(ruby)', section: 'Basic Ruby - Below' },
  { syntax: '[北京]^^(ペキン|Beijing)', section: 'Basic Ruby - Two-level' },
  
  // Per-Character Ruby
  { syntax: '[春夏秋冬]^^(はる なつ あき ふゆ)', section: 'Per-Character - Auto-align' },
  { syntax: '[振り仮名]^^(ふ り が な)', section: 'Per-Character - Auto-hide' },
  
  // Nested / Overlapping
  { syntax: '[base]^^(over)^_(under)', section: 'Chained annotations' },
  { syntax: '[[護]^^(まも)れ]^_(プロテゴ)', section: 'Partially overlapping' },
  
  // Special Patterns
  { syntax: 'base^^(..)', section: 'Bouten - Above' },
  { syntax: 'base^_(..)', section: 'Bouten - Below dotted' },
  { syntax: 'base^_(.-)', section: 'Underline - Solid' },
  { syntax: 'base^_(.=)', section: 'Underline - Double' },
  { syntax: 'base^_(.~)', section: 'Underline - Wavy' },
  { syntax: 'base^^(..)^_(..)', section: 'Bouten - Both levels' },
  
  // Use Cases
  { syntax: '[取り返す]^^(と り かえ す)', section: 'Japanese furigana' },
  { syntax: '[李太白]^^(Lǐ Tài Bái|ㄌㄧˇ ㄊㄞˋ ㄅㄞˊ)', section: 'Chinese pinyin + bopomofo' },
  { syntax: 'cat^^(chat|猫)', section: 'Multi-language translation' },
  { syntax: '貓^^(猫)', section: 'Traditional to Simplified' },
  { syntax: '猫^^(ねこ|neko)', section: 'Japanese transcription' },
  { syntax: '貓^^(māo|cat)', section: 'Chinese to English' },
  { syntax: 'Москва^^(Moskva)', section: 'Cyrillic transliteration' },
  { syntax: 'cat^^(/kæt/)', section: 'IPA transcription' },
  { syntax: '重要^^(..)', section: 'Emphasis with bouten' },
  { syntax: '重要語句^^(じゅうようごく|.-)', section: 'Study aid - ruby + underline' },
  { syntax: '[初音ミク^^(偉大なる|世界一姫様)]^_(Vocaloid)', section: 'Complex nested titles' }
];

function generateExamples() {
  console.log('# README Examples HTML Output\n');
  console.log('Generated examples for README.md documentation:\n');
  console.log('Format: `syntax` → HTML output\n');
  console.log('='.repeat(80) + '\n');

  examples.forEach((example, i) => {
    const html = anyToHTML(example.syntax);
    console.log(`## ${i + 1}. ${example.section}`);
    console.log(`\`${example.syntax}\``);
    console.log(`    > ${html}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`Total examples: ${examples.length}`);
}

function generateMarkdownFormat() {
  console.log('# Markdown Format for README.md\n');
  
  examples.forEach((example) => {
    const html = anyToHTML(example.syntax);
    console.log(`- \`${example.syntax}\` — ${example.section}`);
    console.log(`    > ${html}`);
  });
}

function main() {
  const format = process.argv[2] || 'examples';
  
  switch (format) {
    case 'markdown':
    case 'md':
      generateMarkdownFormat();
      break;
    case 'examples':
    default:
      generateExamples();
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = { examples, generateExamples, generateMarkdownFormat };