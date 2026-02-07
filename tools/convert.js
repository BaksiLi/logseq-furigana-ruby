#!/usr/bin/env node

/**
 * Ruby Annotation Converter
 * 
 * Converts Logseq inline annotation syntax to HTML using the parser.
 * Useful for testing, documentation generation, and migration.
 */

const fs = require('fs');
const path = require('path');

// Import the compiled parser
const { anyToHTML, anyToMarkup, anyToMacro, hasRuby, hasAnyRubyContent } = require('../dist/parser.js');

function showHelp() {
  console.log(`
Ruby Annotation Converter

USAGE:
  node tools/convert.js <input-file> [options]

OPTIONS:
  --output, -o <file>     Output file (default: input + .converted.html)
  --format, -f <format>   Output format: html, markup, macro (default: html)
  --verbose, -v           Verbose output
  --help, -h              Show this help

EXAMPLES:
  node tools/convert.js assets/logseq_inline_annotation.md
  node tools/convert.js test.md --format markup --output test.converted.md
  node tools/convert.js input.txt --format html --output output.html
`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const inputFile = args[0];
  let outputFile = null;
  let format = 'html';
  let verbose = false;

  // Parse arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
      case '-o':
        outputFile = args[++i];
        break;
      case '--format':
      case '-f':
        format = args[++i];
        break;
      case '--verbose':
      case '-v':
        verbose = true;
        break;
    }
  }

  // Validate input
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }

  // Generate output filename if not specified
  if (!outputFile) {
    const ext = format === 'markup' ? '.md' : format === 'macro' ? '.txt' : '.html';
    const basename = path.basename(inputFile, path.extname(inputFile));
    outputFile = path.join(path.dirname(inputFile), `${basename}.converted${ext}`);
  }

  // Read input
  const content = fs.readFileSync(inputFile, 'utf8');
  
  if (verbose) {
    console.log(`📁 Input: ${inputFile}`);
    console.log(`📁 Output: ${outputFile}`);
    console.log(`🔄 Format: ${format}`);
    
    if (hasAnyRubyContent(content)) {
      console.log(`✅ Ruby content detected`);
    } else {
      console.log(`⚠️  No ruby content found`);
    }
  }

  // Convert content
  let result;
  switch (format) {
    case 'html':
      result = anyToHTML(content);
      break;
    case 'markup':
      result = anyToMarkup(content);
      break;
    case 'macro':
      result = anyToMacro(content);
      break;
    default:
      console.error(`❌ Unknown format: ${format}`);
      process.exit(1);
  }

  // Write output
  fs.writeFileSync(outputFile, result, 'utf8');
  
  console.log(`✅ Conversion complete: ${outputFile}`);
  
  if (verbose) {
    console.log(`\n📊 Stats:`);
    console.log(`  Input size: ${content.length} chars`);
    console.log(`  Output size: ${result.length} chars`);
    console.log(`  Ruby content: ${hasAnyRubyContent(content) ? 'Yes' : 'No'}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };