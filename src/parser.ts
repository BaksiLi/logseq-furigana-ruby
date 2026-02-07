/**
 * Ruby (Furigana) parser implementing the proposal syntax.
 *
 * ## Supported Syntax
 * - **Bracketed**: `[base]^^(annotation)` and `[base]^_(annotation)`
 * - **Abbreviated**: `base^^(annotation)` and `base^_(annotation)`
 * - **Multi-level**: `[base]^^(ann1|ann2)` pipe-separated levels (max 2)
 * - **Chained**: `[base]^^(over)^_(under)` — mixed-operator only
 * - **Bouten**: `[漢字]^^(..)` / `[漢字]^_(..)` — emphasis dots
 * - **Both bouten**: `[漢字]^^(..)^_(..)` — dots above + below (ruby + text-emphasis)
 * - **Underline**: `[base]^_(.-)` / `^_(.~)` / `^_(.=)` — solid/wavy/double underline
 * - **Escapes**: `\|`, `\)`, `\]`, `\\` inside base/annotation
 *
 * Reference: https://blog.baksili.codes/markdown-ruby
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RubyOp = "^^" | "^_";

const OP_REGEX = /\^(?:\^|_)\(/g;
const BOUTEN_PATTERN = "..";

type UnderlineStyle = "solid" | "wavy" | "double";

const UNDERLINE_STYLES: Record<string, UnderlineStyle> = {
  ".-": "solid",
  ".~": "wavy",
  ".=": "double",
};

function getUnderlineStyle(pattern: string): UnderlineStyle | null {
  return UNDERLINE_STYLES[pattern] ?? null;
}

function underlineClasses(style: UnderlineStyle): string {
  if (style === "solid") return "ls-ruby-underline";
  return `ls-ruby-underline ls-ruby-underline-${style}`;
}

function underlinePatternFromClasses(el: Element): string | null {
  if (el.classList.contains("ls-ruby-underline-wavy")) return ".~";
  if (el.classList.contains("ls-ruby-underline-double")) return ".=";
  if (el.classList.contains("ls-ruby-underline")) return ".-";
  return null;
}

/** Direct-child query helpers (`:scope >` is unreliable in jsdom for nested ruby) */
function directChildrenByTag(el: Element, tag: string): Element[] {
  const upper = tag.toUpperCase();
  return Array.from(el.children).filter((c) => c.tagName === upper);
}
function firstDirectChildByTag(el: Element, tag: string): Element | null {
  const upper = tag.toUpperCase();
  return Array.from(el.children).find((c) => c.tagName === upper) ?? null;
}

function isEscaped(input: string, i: number): boolean {
  let backslashes = 0;
  for (let j = i - 1; j >= 0 && input[j] === "\\"; j--) backslashes++;
  return backslashes % 2 === 1;
}

function unescape(input: string): string {
  return input.replace(/\\(.)/g, "$1");
}

function splitByUnescapedPipe(input: string): string[] {
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "|" && !isEscaped(input, i)) {
      out.push(buf);
      buf = "";
    } else {
      buf += input[i];
    }
  }
  out.push(buf);
  return out;
}

function findCloseParen(input: string, start: number): number {
  for (let i = start; i < input.length; i++) {
    if (input[i] === "\n" || input[i] === "\r") return -1;
    if (input[i] === ")" && !isEscaped(input, i)) return i;
  }
  return -1;
}

function findOpenBracket(input: string, closeBracketIdx: number): number {
  for (let i = closeBracketIdx - 1; i >= 0; i--) {
    if (input[i] === "\n" || input[i] === "\r") return -1;
    if (input[i] === "[" && !isEscaped(input, i)) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Inline style constants (for HTML portability outside Logseq)
// ---------------------------------------------------------------------------

const STYLE_BOUTEN_OVER = "text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right";
const STYLE_BOUTEN_UNDER = "text-decoration:underline dotted;text-underline-offset:0.15em";
const STYLE_RUBY_UNDER = "ruby-position:under";

function underlineInlineStyle(style: UnderlineStyle): string {
  let s = "text-decoration-line:underline;text-underline-offset:0.15em";
  if (style === "wavy") s += ";text-decoration-style:wavy";
  else if (style === "double") s += ";text-decoration-style:double";
  return s;
}

function boutenInlineStyle(op: RubyOp): string {
  return op === "^^" ? STYLE_BOUTEN_OVER : STYLE_BOUTEN_UNDER;
}

/** Return ` style="..."` attr for under-positioned ruby, empty for over */
function rubyPosAttr(pos: string): string {
  return pos === "ls-ruby-under" ? ` style="${STYLE_RUBY_UNDER}"` : "";
}

/** Wrap a character in an empty-annotation ruby to preserve vertical spacing */
function emptyRuby(char: string, pos: string): string {
  return `<ruby class="ls-ruby ${pos}"${rubyPosAttr(pos)}>${char}<rp>(</rp><rt></rt><rp>)</rp></ruby>`;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/**
 * Bouten rendering.
 * - Over (^^): real CSS text-emphasis dots — works perfectly in Chromium.
 * - Under (^_): dotted underline fallback — text-emphasis-position:under
 *   is unreliably clipped by Logseq's Electron container. Dotted underline
 *   is semantically close and renders stably.
 */
function renderBouten(base: string, op: RubyOp): string {
  const pos = op === "^^" ? "ls-ruby-bouten-over" : "ls-ruby-bouten-under";
  return `<span class="ls-ruby-bouten ${pos}" style="${boutenInlineStyle(op)}">${unescape(base)}</span>`;
}

function renderBoutenBoth(base: string): string {
  // Over = text-emphasis, Under = dotted underline, on the same element
  return `<span class="ls-ruby-bouten ls-ruby-bouten-over ls-ruby-bouten-under" style="${STYLE_BOUTEN_OVER};${STYLE_BOUTEN_UNDER}">${unescape(base)}</span>`;
}

function renderUnderline(base: string, style: UnderlineStyle = "solid"): string {
  return `<span class="${underlineClasses(style)}" style="${underlineInlineStyle(style)}">${unescape(base)}</span>`;
}

/**
 * Render mixed: ruby annotation on one side + bouten/underline on the other
 */
function renderRubyWithBouten(base: string, rubyText: string, rubyOp: RubyOp, boutenOp: RubyOp): string {
  const safeBase = unescape(base);
  const rubyPos = rubyOp === "^^" ? "ls-ruby-over" : "ls-ruby-under";
  const boutenPos = boutenOp === "^^" ? "over" : "under";
  const styles = [rubyPos === "ls-ruby-under" ? STYLE_RUBY_UNDER : "", boutenInlineStyle(boutenOp)].filter(Boolean).join(";");
  return `<ruby class="ls-ruby ls-ruby-mixed ${rubyPos} ls-ruby-bouten-${boutenPos}" style="${styles}">${safeBase}<rp>(</rp><rt>${rubyText}</rt><rp>)</rp></ruby>`;
}

function renderRubyWithUnderline(base: string, rubyText: string, rubyOp: RubyOp, style: UnderlineStyle = "solid"): string {
  const safeBase = unescape(base);
  const rubyPos = rubyOp === "^^" ? "ls-ruby-over" : "ls-ruby-under";
  const styles = [rubyPos === "ls-ruby-under" ? STYLE_RUBY_UNDER : "", underlineInlineStyle(style)].filter(Boolean).join(";");
  return `<ruby class="ls-ruby ls-ruby-mixed ${rubyPos} ${underlineClasses(style)}" style="${styles}">${safeBase}<rp>(</rp><rt>${rubyText}</rt><rp>)</rp></ruby>`;
}

/**
 * Split annotation by spaces, trimming each part
 */
function splitBySpaces(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Count actual characters (not bytes) in a string
 */
function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * Check if annotation can be auto-hidden (matches base character)
 */
function shouldHideAnnotation(baseChar: string, annotation: string): boolean {
  return baseChar === annotation;
}

function renderRuby(base: string, op: RubyOp, levels: string[]): string {
  const safeBase = unescape(base);
  const capped = levels.slice(0, 2);
  const baseChars = Array.from(safeBase);

  // --- Two levels: try per-character alignment independently for each level ---
  if (capped.length === 2) {
    const ann1Parts = capped[0].includes(" ") ? splitBySpaces(capped[0]) : null;
    const ann2Parts = capped[1].includes(" ") ? splitBySpaces(capped[1]) : null;
    const can1Align = ann1Parts !== null && ann1Parts.length === baseChars.length;
    const can2Align = ann2Parts !== null && ann2Parts.length === baseChars.length;
    const innerPos = op === "^^" ? "ls-ruby-over" : "ls-ruby-under";
    const outerPos = op === "^^" ? "ls-ruby-under" : "ls-ruby-over";

    if (can1Align && can2Align) {
      // Both levels per-character aligned
      let result = "";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const a1 = ann1Parts![i];
        const a2 = ann2Parts![i];
        const hide1 = shouldHideAnnotation(char, a1);
        const hide2 = shouldHideAnnotation(char, a2);
        if (hide1 && hide2) {
          result += emptyRuby(char, innerPos);
        } else if (hide1) {
          result += `<ruby class="ls-ruby ${outerPos}"${rubyPosAttr(outerPos)}>${char}<rp>(</rp><rt>${a2}</rt><rp>)</rp></ruby>`;
        } else if (hide2) {
          result += `<ruby class="ls-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${char}<rp>(</rp><rt>${a1}</rt><rp>)</rp></ruby>`;
        } else {
          result += `<ruby class="ls-ruby ${outerPos} ls-ruby-double"${rubyPosAttr(outerPos)}><ruby class="ls-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${char}<rp>(</rp><rt>${a1}</rt><rp>)</rp></ruby><rp>(</rp><rt>${a2}</rt><rp>)</rp></ruby>`;
        }
      }
      return result;
    }

    if (can1Align) {
      // First level per-character, second level group
      let innerRubies = "";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const ann = ann1Parts![i];
        if (shouldHideAnnotation(char, ann)) {
          innerRubies += emptyRuby(char, innerPos);
        } else {
          innerRubies += `<ruby class="ls-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${char}<rp>(</rp><rt>${ann}</rt><rp>)</rp></ruby>`;
        }
      }
      return (
        `<ruby class="ls-ruby ${outerPos} ls-ruby-double"${rubyPosAttr(outerPos)}>` +
        innerRubies +
        `<rp>(</rp><rt>${capped[1]}</rt><rp>)</rp></ruby>`
      );
    }

    if (can2Align) {
      // First level group, second level per-character
      let innerRubies = "";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const ann = ann2Parts![i];
        if (shouldHideAnnotation(char, ann)) {
          innerRubies += emptyRuby(char, outerPos);
        } else {
          innerRubies += `<ruby class="ls-ruby ${outerPos}"${rubyPosAttr(outerPos)}>${char}<rp>(</rp><rt>${ann}</rt><rp>)</rp></ruby>`;
        }
      }
      return (
        `<ruby class="ls-ruby ${innerPos} ls-ruby-double"${rubyPosAttr(innerPos)}>` +
        innerRubies +
        `<rp>(</rp><rt>${capped[0]}</rt><rp>)</rp></ruby>`
      );
    }

    // Neither can align: standard double-level group ruby
    return (
      `<ruby class="ls-ruby ${outerPos} ls-ruby-double"${rubyPosAttr(outerPos)}>` +
      `<ruby class="ls-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${safeBase}<rp>(</rp><rt>${capped[0]}</rt><rp>)</rp></ruby>` +
      `<rp>(</rp><rt>${capped[1]}</rt><rp>)</rp></ruby>`
    );
  }

  // --- Single level: try per-character alignment ---
  if (capped.length === 1 && capped[0].includes(" ")) {
    const annParts = splitBySpaces(capped[0]);
    if (annParts.length === baseChars.length) {
      let result = "";
      const pos = op === "^^" ? "ls-ruby-over" : "ls-ruby-under";
      for (let i = 0; i < baseChars.length; i++) {
        const char = baseChars[i];
        const ann = annParts[i];
        if (shouldHideAnnotation(char, ann)) {
          result += emptyRuby(char, pos);
        } else {
          result += `<ruby class="ls-ruby ${pos}"${rubyPosAttr(pos)}>${char}<rp>(</rp><rt>${ann}</rt><rp>)</rp></ruby>`;
        }
      }
      return result;
    }
  }

  // --- Fallback: standard group ruby ---
  if (capped.length === 1) {
    const pos = op === "^^" ? "ls-ruby-over" : "ls-ruby-under";
    return `<ruby class="ls-ruby ${pos}"${rubyPosAttr(pos)}>${safeBase}<rp>(</rp><rt>${capped[0]}</rt><rp>)</rp></ruby>`;
  }

  // Two levels group: nested <ruby> (Chromium doesn't support <rtc>)
  const innerPos = op === "^^" ? "ls-ruby-over" : "ls-ruby-under";
  const outerPos = op === "^^" ? "ls-ruby-under" : "ls-ruby-over";
  return (
    `<ruby class="ls-ruby ${outerPos} ls-ruby-double"${rubyPosAttr(outerPos)}>` +
    `<ruby class="ls-ruby ${innerPos}"${rubyPosAttr(innerPos)}>${safeBase}<rp>(</rp><rt>${capped[0]}</rt><rp>)</rp></ruby>` +
    `<rp>(</rp><rt>${capped[1]}</rt><rp>)</rp></ruby>`
  );
}

// ---------------------------------------------------------------------------
// Code protection — skip content inside backtick code in block strings
// ---------------------------------------------------------------------------

interface ProtectedContent {
  result: string;
  tokens: string[];
}

function protectCode(content: string): ProtectedContent {
  const tokens: string[] = [];
  // Protect fenced code blocks (```...```) and inline code (`...`)
  // Use \uE000 (PUA char) as sentinel — survives DOMParser unlike \x00
  const result = content.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `\uE000CODE${idx}\uE000`;
  });
  return { result, tokens };
}

function restoreCode(content: string, tokens: string[]): string {
  let result = content;
  for (let i = 0; i < tokens.length; i++) {
    result = result.split(`\uE000CODE${i}\uE000`).join(tokens[i]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function hasRuby(text: string): boolean {
  return text.includes("^^(") || text.includes("^_(");
}

export function hasAnyRubyContent(text: string): boolean {
  return hasRuby(text) || text.includes("<ruby") || text.includes("ls-ruby") || text.includes("{{renderer :ruby");
}

const MACRO_RE = /\{\{renderer\s+:ruby,\s*([^,}]+),\s*([^,}]+)(?:,\s*([^}]+))?\}\}/g;

/**
 * Convert `^^()` / `^_()` markup to HTML (single pass).
 */
function rubyToHTMLPass(input: string): string {
  if (!hasRuby(input)) return input;

  let out = "";
  let i = 0;

  while (i < input.length) {
    OP_REGEX.lastIndex = i;
    const m = OP_REGEX.exec(input);
    if (!m) {
      out += input.slice(i);
      break;
    }

    const opStart = m.index;
    const op: RubyOp = input[opStart + 1] === "^" ? "^^" : "^_";

    let baseStart = -1;
    let baseHtml = "";
    const consumedFrom = i;

    if (opStart > 0 && input[opStart - 1] === "]" && !isEscaped(input, opStart - 1)) {
      const open = findOpenBracket(input, opStart - 1);
      // Skip brackets that were already consumed (nested bracket support)
      if (open >= 0 && open >= consumedFrom) {
        baseStart = open;
        baseHtml = input.slice(open + 1, opStart - 1);
      }
    } else {
      let k = opStart - 1;
      while (k >= 0) {
        const ch = input[k];
        if (/\s/.test(ch)) break;
        if ((ch === "[" || ch === "]") && !isEscaped(input, k)) break;
        k--;
      }
      baseStart = k + 1;
      baseHtml = input.slice(baseStart, opStart);
    }

    if (baseStart < consumedFrom || baseStart < 0 || baseHtml.length === 0) {
      out += input.slice(i, opStart + 1);
      i = opStart + 1;
      continue;
    }

    const annStart = opStart + 3;
    const annEnd = findCloseParen(input, annStart);
    if (annEnd < 0) {
      out += input.slice(i);
      break;
    }

    const rawAnn = input.slice(annStart, annEnd);
    if (rawAnn.length === 0) {
      out += input.slice(i, annEnd + 1);
      i = annEnd + 1;
      continue;
    }

    // --- Chained second operator (mixed only) ---
    let finalEnd = annEnd + 1;
    let rawAnn2: string | null = null;
    let op2: RubyOp | null = null;
    const next = annEnd + 1;

    if (
      next + 2 < input.length &&
      input[next] === "^" &&
      (input[next + 1] === "^" || input[next + 1] === "_") &&
      input[next + 2] === "("
    ) {
      const nextOp: RubyOp = input[next + 1] === "^" ? "^^" : "^_";
      if (nextOp !== op) {
        const annStart2 = next + 3;
        const annEnd2 = findCloseParen(input, annStart2);
        if (annEnd2 >= 0) {
          const candidate = input.slice(annStart2, annEnd2);
          if (candidate.length > 0) {
            rawAnn2 = candidate;
            op2 = nextOp;
            finalEnd = annEnd2 + 1;
          }
        }
      }
    }

    // If first annotation already has pipe-separated levels (filling both positions),
    // ignore the chained operator — prefer first-come.
    if (rawAnn2 !== null && splitByUnescapedPipe(rawAnn).length > 1) {
      rawAnn2 = null;
      op2 = null;
      // Keep finalEnd to consume the chained text silently
    }

    // --- Special pattern detection ---
    const isBouten1 = rawAnn === BOUTEN_PATTERN;
    const isBouten2 = rawAnn2 === BOUTEN_PATTERN;
    const ulStyle1 = op === "^_" ? getUnderlineStyle(rawAnn) : null;
    const ulStyle2 = op2 === "^_" ? getUnderlineStyle(rawAnn2 ?? "") : null;
    const isUnderline1 = ulStyle1 !== null;
    const isUnderline2 = ulStyle2 !== null;
    const isSpecial1 = isBouten1 || isUnderline1;
    const isSpecial2 = isBouten2 || isUnderline2;

    // --- Case 1: BOTH are special patterns ---
    if (isSpecial1 && isSpecial2) {
      out += input.slice(consumedFrom, baseStart);
      
      // Bouten + Underline combination
      if ((isBouten1 && isUnderline2) || (isUnderline1 && isBouten2)) {
        const boutenOp = isBouten1 ? op : op2;
        const ulStyle = isUnderline1 ? ulStyle1! : ulStyle2!;
        const comboStyle = [boutenInlineStyle(boutenOp!), underlineInlineStyle(ulStyle)].join(";");
        out += `<span class="ls-ruby-bouten ls-ruby-bouten-${boutenOp === "^^" ? "over" : "under"} ${underlineClasses(ulStyle)}" style="${comboStyle}">${unescape(baseHtml)}</span>`;
      }
      // Bouten + Bouten (both dots)
      else if (isBouten1 && isBouten2) {
        out += renderBoutenBoth(baseHtml);
      }
      // Underline + Underline (just one underline — prefer first)
      else {
        out += renderUnderline(baseHtml, ulStyle1!);
      }
      
      i = finalEnd;
      continue;
    }

    // --- Case 2: ONLY first is special pattern (no chain) ---
    if (isSpecial1 && !rawAnn2) {
      out += input.slice(consumedFrom, baseStart);
      
      if (isBouten1) {
        out += renderBouten(baseHtml, op);
      } else {
        out += renderUnderline(baseHtml, ulStyle1!);
      }
      
      i = annEnd + 1;
      continue;
    }

    // --- Case 3: Mixed special pattern + regular ruby text ---
    if (rawAnn2 && (isSpecial1 || isSpecial2)) {
      out += input.slice(consumedFrom, baseStart);
      
      // One is special, one is regular text
      if (isSpecial1 && !isSpecial2) {
        // First is special (bouten/underline), second is ruby text
        const rubyText = unescape(rawAnn2);
        if (isBouten1) {
          out += renderRubyWithBouten(baseHtml, rubyText, op2!, op);
        } else {
          out += renderRubyWithUnderline(baseHtml, rubyText, op2!, ulStyle1!);
        }
      } else if (!isSpecial1 && isSpecial2) {
        // First is ruby text, second is special (bouten/underline)
        const rubyText = unescape(rawAnn);
        if (isBouten2) {
          out += renderRubyWithBouten(baseHtml, rubyText, op, op2!);
        } else {
          out += renderRubyWithUnderline(baseHtml, rubyText, op, ulStyle2!);
        }
      }
      
      i = finalEnd;
      continue;
    }

    // --- Case 4: Regular ruby (both are normal text) ---
    const levels = splitByUnescapedPipe(rawAnn).map(unescape);
    if (rawAnn2) {
      levels.push(...splitByUnescapedPipe(rawAnn2).map(unescape));
    }

    // Detect special patterns in pipe-separated levels
    if (levels.length === 2 && !rawAnn2) {
      const innerOp = op;
      const outerOp: RubyOp = op === "^^" ? "^_" : "^^";

      const isInnerBouten = levels[0] === BOUTEN_PATTERN;
      const isOuterBouten = levels[1] === BOUTEN_PATTERN;
      const innerUlStyle = innerOp === "^_" ? getUnderlineStyle(levels[0]) : null;
      const outerUlStyle = outerOp === "^_" ? getUnderlineStyle(levels[1]) : null;
      const isInnerUnderline = innerUlStyle !== null;
      const isOuterUnderline = outerUlStyle !== null;
      const isInnerSpecial = isInnerBouten || isInnerUnderline;
      const isOuterSpecial = isOuterBouten || isOuterUnderline;

      if (isInnerSpecial || isOuterSpecial) {
        out += input.slice(consumedFrom, baseStart);

        if (isInnerSpecial && isOuterSpecial) {
          if (isInnerBouten && isOuterBouten) {
            out += renderBoutenBoth(baseHtml);
          } else if ((isInnerBouten || isOuterBouten) && (isInnerUnderline || isOuterUnderline)) {
            const boutenOp = isInnerBouten ? innerOp : outerOp;
            const pipeUlStyle = isInnerUnderline ? innerUlStyle! : outerUlStyle!;
            const comboStyle2 = [boutenInlineStyle(boutenOp), underlineInlineStyle(pipeUlStyle)].join(";");
            out += `<span class="ls-ruby-bouten ls-ruby-bouten-${boutenOp === "^^" ? "over" : "under"} ${underlineClasses(pipeUlStyle)}" style="${comboStyle2}">${unescape(baseHtml)}</span>`;
          } else {
            out += renderUnderline(baseHtml, innerUlStyle!);
          }
        } else if (isInnerSpecial) {
          if (isInnerBouten) {
            out += renderRubyWithBouten(baseHtml, levels[1], outerOp, innerOp);
          } else {
            out += renderRubyWithUnderline(baseHtml, levels[1], outerOp, innerUlStyle!);
          }
        } else {
          if (isOuterBouten) {
            out += renderRubyWithBouten(baseHtml, levels[0], innerOp, outerOp);
          } else {
            out += renderRubyWithUnderline(baseHtml, levels[0], innerOp, outerUlStyle!);
          }
        }

        i = finalEnd;
        continue;
      }
    }

    out += input.slice(consumedFrom, baseStart);
    out += renderRuby(baseHtml, op, levels);
    i = finalEnd;
  }

  return out;
}

/**
 * Convert `^^()` / `^_()` markup to HTML.
 * Runs multiple passes to support nested bracket expressions.
 */
export function rubyToHTML(input: string): string {
  if (!hasRuby(input)) return input;
  let result = input;
  for (let pass = 0; pass < 5; pass++) {
    const next = rubyToHTMLPass(result);
    if (next === result) break;
    result = next;
    if (!hasRuby(result)) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Conversion: any ruby format → markup (code-safe)
// ---------------------------------------------------------------------------

export function anyToMarkup(content: string): string {
  const { result: safe, tokens } = protectCode(content);
  let result = safe;

  // Macros → markup
  MACRO_RE.lastIndex = 0;
  result = result.replace(MACRO_RE, (_match, base, ann, pos) => {
    const b = (base ?? "").trim();
    const a = (ann ?? "").trim();
    if (!b || !a) return _match;
    const p = (pos ?? "").trim().toLowerCase();
    const op = p === "under" ? "^_" : "^^";
    return `[${b}]${op}(${a})`;
  });

  // HTML → markup
  if (result.includes("<ruby") || result.includes("ls-ruby")) {
    result = rubyHtmlToMarkup(result);
  }

  return restoreCode(result, tokens);
}

// ---------------------------------------------------------------------------
// Conversion: any ruby format → macro (code-safe)
// ---------------------------------------------------------------------------

export function anyToMacro(content: string): string {
  const { result: safe, tokens } = protectCode(content);
  let result = safe;

  // Markup → macro
  if (hasRuby(result)) {
    result = markupToMacro(result);
  }

  // HTML → macro
  if (result.includes("<ruby") || result.includes("ls-ruby")) {
    const doc = new DOMParser().parseFromString(`<div>${result}</div>`, "text/html");
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (root) {
      htmlElementsToMacro(root);
      result = root.innerHTML;
    }
  }

  return restoreCode(result, tokens);
}

function markupToMacro(input: string): string {
  if (!hasRuby(input)) return input;

  let out = "";
  let i = 0;

  while (i < input.length) {
    OP_REGEX.lastIndex = i;
    const m = OP_REGEX.exec(input);
    if (!m) {
      out += input.slice(i);
      break;
    }

    const opStart = m.index;
    const op: RubyOp = input[opStart + 1] === "^" ? "^^" : "^_";

    let baseStart = -1;
    let baseHtml = "";
    const consumedFrom = i;

    if (opStart > 0 && input[opStart - 1] === "]" && !isEscaped(input, opStart - 1)) {
      const open = findOpenBracket(input, opStart - 1);
      if (open >= 0 && open >= consumedFrom) {
        baseStart = open;
        baseHtml = input.slice(open + 1, opStart - 1);
      }
    } else {
      let k = opStart - 1;
      while (k >= 0) {
        const ch = input[k];
        if (/\s/.test(ch)) break;
        if ((ch === "[" || ch === "]") && !isEscaped(input, k)) break;
        k--;
      }
      baseStart = k + 1;
      baseHtml = input.slice(baseStart, opStart);
    }

    if (baseStart < consumedFrom || baseStart < 0 || baseHtml.length === 0) {
      out += input.slice(i, opStart + 1);
      i = opStart + 1;
      continue;
    }

    const annStart = opStart + 3;
    const annEnd = findCloseParen(input, annStart);
    if (annEnd < 0) {
      out += input.slice(i);
      break;
    }

    const rawAnn = input.slice(annStart, annEnd);
    if (rawAnn.length === 0) {
      out += input.slice(i, annEnd + 1);
      i = annEnd + 1;
      continue;
    }

    const base = unescape(baseHtml);
    const ann = unescape(rawAnn);
    const posArg = op === "^_" ? ", under" : "";

    out += input.slice(consumedFrom, baseStart);
    out += `{{renderer :ruby, ${base}, ${ann}${posArg}}}`;
    i = annEnd + 1;
  }

  return out;
}

function htmlElementsToMacro(root: HTMLElement): void {
  let rubies = Array.from(root.querySelectorAll("ruby"));
  while (rubies.length > 0) {
    for (const ruby of rubies) {
      if (!ruby.parentNode) continue;

      // Mixed ruby — macro only preserves ruby text (decoration lost)
      if (ruby.classList.contains("ls-ruby-mixed")) {
        const baseClone = ruby.cloneNode(true) as HTMLElement;
        baseClone.querySelectorAll("rt, rp").forEach((n) => n.remove());
        const base = (baseClone.textContent ?? "").trim();
        const rt = firstDirectChildByTag(ruby, "rt");
        const rubyText = rt ? (rt.textContent ?? "").trim() : "";
        if (!base || !rubyText) continue;
        const posArg = ruby.classList.contains("ls-ruby-under") ? ", under" : "";
        ruby.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ${rubyText}${posArg}}}`));
        continue;
      }

      const innerRuby = firstDirectChildByTag(ruby, "ruby");
      if (innerRuby) {
        const outerRts = directChildrenByTag(ruby, "rt").map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);
        const innerClone = innerRuby.cloneNode(true) as HTMLElement;
        innerClone.querySelectorAll("rt, rp").forEach((n) => n.remove());
        const base = (innerClone.textContent ?? "").trim();
        const innerRts = directChildrenByTag(innerRuby, "rt").map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);
        const levels = [...innerRts, ...outerRts].filter(Boolean);
        const ann = levels.join("|");
        const posArg = innerRuby.classList.contains("ls-ruby-under") ? ", under" : "";
        if (ann) ruby.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ${ann}${posArg}}}`));
        continue;
      }

      const baseClone = ruby.cloneNode(true) as HTMLElement;
      baseClone.querySelectorAll("rt, rp, rtc").forEach((n) => n.remove());
      const base = (baseClone.textContent ?? "").trim();
      const rts = directChildrenByTag(ruby, "rt").map(
        (rt) => (rt.textContent ?? "").trim()
      );
      const rtcs = directChildrenByTag(ruby, "rtc").map(
        (rtc) => (rtc.textContent ?? "").trim()
      );
      const levels = [...rts, ...rtcs].filter(Boolean);
      const ann = levels.join("|");
      const posArg = ruby.classList.contains("ls-ruby-under") ? ", under" : "";
      if (ann) ruby.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ${ann}${posArg}}}`));
    }
    rubies = Array.from(root.querySelectorAll("ruby"));
  }

  for (const span of Array.from(root.querySelectorAll("span.ls-ruby-bouten"))) {
    const base = (span.textContent ?? "").trim();
    const isOver = span.classList.contains("ls-ruby-bouten-over");
    const isUnder = span.classList.contains("ls-ruby-bouten-under");
    const isUnderline = span.classList.contains("ls-ruby-underline");
    
    // Note: Macro format doesn't support bouten + underline combo directly,
    // so we convert to the primary effect (bouten)
    if (isUnderline) {
      // For bouten + underline, prioritize the bouten in macro format
      const pos = isUnder ? ", under" : "";
      span.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ..${pos}}}`));
    } else {
      const pos = isUnder ? ", under" : "";
      span.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ..${pos}}}`));
    }
  }

  for (const span of Array.from(root.querySelectorAll("span.ls-ruby-underline:not(.ls-ruby-bouten)"))) {
    const base = (span.textContent ?? "").trim();
    const ulPat = underlinePatternFromClasses(span) ?? ".-";
    span.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ${ulPat}, under}}`));
  }
}

// ---------------------------------------------------------------------------
// Conversion: any ruby format → HTML (code-safe)
// ---------------------------------------------------------------------------

export function anyToHTML(content: string): string {
  const { result: safe, tokens } = protectCode(content);
  let result = safe;

  // Macros → HTML
  MACRO_RE.lastIndex = 0;
  result = result.replace(MACRO_RE, (_match, base, ann, pos) => {
    const args = [":ruby", base, ann];
    if (pos) args.push(pos);
    return renderMacroRuby(args) ?? _match;
  });

  // Markup → HTML
  if (hasRuby(result)) {
    result = rubyToHTML(result);
  }

  return restoreCode(result, tokens);
}

// ---------------------------------------------------------------------------
// Conversion: HTML/bouten/underline → markup (best-effort)
// ---------------------------------------------------------------------------

export function rubyHtmlToMarkup(html: string): string {
  if (!html.includes("<ruby") && !html.includes("ls-ruby")) return html;

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;

  // Process rubies (handle nested double-level: outer wraps inner)
  // Iterate until no more rubies remain (inner ones get converted first)
  let rubies = Array.from(root.querySelectorAll("ruby"));
  while (rubies.length > 0) {
    for (const ruby of rubies) {
      if (!ruby.parentNode) continue;

      // Mixed ruby (ruby + bouten/underline)?
      if (ruby.classList.contains("ls-ruby-mixed")) {
        const baseClone = ruby.cloneNode(true) as HTMLElement;
        baseClone.querySelectorAll("rt, rp").forEach((n) => n.remove());
        const base = (baseClone.textContent ?? "").trim();
        const rt = firstDirectChildByTag(ruby, "rt");
        const rubyText = rt ? (rt.textContent ?? "").trim() : "";
        if (!base || !rubyText) continue;
        const rubyOp = ruby.classList.contains("ls-ruby-over") ? "^^" : "^_";
        const ulPat = underlinePatternFromClasses(ruby);
        const isBoutenOver = ruby.classList.contains("ls-ruby-bouten-over");
        const isBoutenUnder = ruby.classList.contains("ls-ruby-bouten-under");
        let decoMarkup = "";
        if (ulPat) {
          decoMarkup = `^_(${ulPat})`;
        } else if (isBoutenOver) {
          decoMarkup = `^^(..)`;
        } else if (isBoutenUnder) {
          decoMarkup = `^_(..)`;
        }
        ruby.replaceWith(doc.createTextNode(`[${base}]${rubyOp}(${rubyText})${decoMarkup}`));
        continue;
      }

      // Nested double-level?
      const innerRuby = firstDirectChildByTag(ruby, "ruby");
      if (innerRuby) {
        const outerRts = directChildrenByTag(ruby, "rt").map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);

        const innerClone = innerRuby.cloneNode(true) as HTMLElement;
        innerClone.querySelectorAll("rt, rp").forEach((n) => n.remove());
        const base = (innerClone.textContent ?? "").trim();
        const innerRts = directChildrenByTag(innerRuby, "rt").map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);

        const levels = [...innerRts, ...outerRts].filter(Boolean);
        const ann = levels.join("|");
        const innerOp = innerRuby.classList.contains("ls-ruby-over") ? "^^" : "^_";
        ruby.replaceWith(doc.createTextNode(ann ? `[${base}]${innerOp}(${ann})` : base));
        continue;
      }

      // Simple ruby (single-level or legacy <rtc>)
      const baseClone = ruby.cloneNode(true) as HTMLElement;
      baseClone.querySelectorAll("rt, rp, rtc").forEach((n) => n.remove());
      const base = (baseClone.textContent ?? "").trim();

      const rts = directChildrenByTag(ruby, "rt").map(
        (rt) => (rt.textContent ?? "").trim()
      );
      const rtcs = directChildrenByTag(ruby, "rtc").map(
        (rtc) => (rtc.textContent ?? "").trim()
      );
      const levels = [...rts, ...rtcs].filter(Boolean);
      const ann = levels.join("|");
      const op = ruby.classList.contains("ls-ruby-under") ? "^_" : "^^";
      ruby.replaceWith(doc.createTextNode(ann ? `[${base}]${op}(${ann})` : base));
    }
    rubies = Array.from(root.querySelectorAll("ruby"));
  }

  for (const span of Array.from(root.querySelectorAll("span.ls-ruby-bouten"))) {
    const base = (span.textContent ?? "").trim();
    if (!base) continue;
    const isOver = span.classList.contains("ls-ruby-bouten-over");
    const isUnder = span.classList.contains("ls-ruby-bouten-under");
    const ulPattern = underlinePatternFromClasses(span);
    
    // Bouten + Underline combinations
    if (ulPattern && isOver) {
      span.replaceWith(doc.createTextNode(`[${base}]^^(..)^_(${ulPattern})`));
    } else if (ulPattern && isUnder) {
      span.replaceWith(doc.createTextNode(`[${base}]^_(${ulPattern})^^(..)`));
    } else if (isOver && isUnder) {
      span.replaceWith(doc.createTextNode(`[${base}]^^(..)^_(..)`));
    } else if (isUnder) {
      span.replaceWith(doc.createTextNode(`[${base}]^_(..)`));
    } else {
      span.replaceWith(doc.createTextNode(`[${base}]^^(..)`));
    }
  }

  for (const span of Array.from(root.querySelectorAll("span.ls-ruby-underline:not(.ls-ruby-bouten)"))) {
    const base = (span.textContent ?? "").trim();
    const ulPat = underlinePatternFromClasses(span) ?? ".-";
    span.replaceWith(doc.createTextNode(`[${base}]^_(${ulPat})`));
  }

  return root.innerHTML;
}

// ---------------------------------------------------------------------------
// DOM live rendering
// ---------------------------------------------------------------------------

const SKIP_TAGS = new Set(["CODE", "PRE", "A", "RUBY", "SCRIPT", "STYLE"]);

export function replaceRubyInElement(el: HTMLElement): void {
  if (el.querySelector("ruby.ls-ruby, span.ls-ruby-bouten")) return;

  let anyReplaced = false;
  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has((node as Element).tagName)) return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!hasRuby(text)) return;
      const html = rubyToHTML(text);
      if (html === text) return;

      const temp = document.createElement("span");
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) frag.appendChild(temp.firstChild);
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
      anyReplaced = true;
      return;
    }
    const children = Array.from(node.childNodes);
    for (const child of children) walk(child);
  };
  walk(el);

  // innerHTML fallback for patterns split across DOM nodes by markdown
  if (!anyReplaced || hasRuby(el.innerHTML)) {
    const html = el.innerHTML;
    if (!hasRuby(html)) return;

    const protectRe = /<(code|pre|a|ruby|script|style)\b[\s\S]*?<\/\1>/gi;
    const saved: string[] = [];
    const tokenized = html.replace(protectRe, (match) => {
      const idx = saved.length;
      saved.push(match);
      return `\x00PROTECT${idx}\x00`;
    });

    const converted = rubyToHTML(tokenized);
    if (converted === tokenized) return;

    let result = converted;
    for (let idx = 0; idx < saved.length; idx++) {
      result = result.split(`\x00PROTECT${idx}\x00`).join(saved[idx]);
    }

    if (result !== html) {
      el.innerHTML = result;
    }
  }
}

// ---------------------------------------------------------------------------
// Macro renderer helper
// ---------------------------------------------------------------------------

export function renderMacroRuby(args: string[]): string | null {
  if (args.length < 3) return null;
  const base = args[1]?.trim();
  const rawAnn = args[2]?.trim();
  if (!base || !rawAnn) return null;

  const posArg = (args[3] ?? "").trim().toLowerCase();
  const op: RubyOp = posArg === "under" ? "^_" : "^^";

  if (rawAnn === BOUTEN_PATTERN) return renderBouten(base, op);
  const macroUlStyle = op === "^_" ? getUnderlineStyle(rawAnn) : null;
  if (macroUlStyle !== null) return renderUnderline(base, macroUlStyle);

  const levels = splitByUnescapedPipe(rawAnn).map(unescape);
  return renderRuby(base, op, levels);
}
