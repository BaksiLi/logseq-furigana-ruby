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
 * - **Underline**: `[base]^_(.-)` — text-decoration underline (toggleable)
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
const UNDERLINE_PATTERN = ".-";

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
    if (input[i] === ")" && !isEscaped(input, i)) return i;
  }
  return -1;
}

function findOpenBracket(input: string, closeBracketIdx: number): number {
  for (let i = closeBracketIdx - 1; i >= 0; i--) {
    if (input[i] === "[" && !isEscaped(input, i)) return i;
  }
  return -1;
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
  return `<span class="ls-ruby-bouten ${pos}">${unescape(base)}</span>`;
}

function renderBoutenBoth(base: string): string {
  // Over = text-emphasis, Under = dotted underline, on the same element
  return `<span class="ls-ruby-bouten ls-ruby-bouten-over ls-ruby-bouten-under">${unescape(base)}</span>`;
}

function renderUnderline(base: string): string {
  return `<span class="ls-ruby-underline">${unescape(base)}</span>`;
}

/**
 * Render mixed: ruby annotation on one side + bouten/underline on the other
 */
function renderRubyWithBouten(base: string, rubyText: string, rubyOp: RubyOp, boutenOp: RubyOp): string {
  const safeBase = unescape(base);
  const rubyPos = rubyOp === "^^" ? "ls-ruby-over" : "ls-ruby-under";
  const boutenPos = boutenOp === "^^" ? "over" : "under";
  return `<ruby class="ls-ruby ls-ruby-mixed ${rubyPos} ls-ruby-bouten-${boutenPos}">${safeBase}<rp>(</rp><rt>${rubyText}</rt><rp>)</rp></ruby>`;
}

function renderRubyWithUnderline(base: string, rubyText: string, rubyOp: RubyOp): string {
  const safeBase = unescape(base);
  const rubyPos = rubyOp === "^^" ? "ls-ruby-over" : "ls-ruby-under";
  return `<ruby class="ls-ruby ls-ruby-mixed ${rubyPos} ls-ruby-underline">${safeBase}<rp>(</rp><rt>${rubyText}</rt><rp>)</rp></ruby>`;
}

function renderRuby(base: string, op: RubyOp, levels: string[]): string {
  const safeBase = unescape(base);
  const capped = levels.slice(0, 2);

  if (capped.length === 1) {
    const pos = op === "^^" ? "ls-ruby-over" : "ls-ruby-under";
    return `<ruby class="ls-ruby ${pos}">${safeBase}<rp>(</rp><rt>${capped[0]}</rt><rp>)</rp></ruby>`;
  }

  // Two levels: use nested <ruby> (Chromium doesn't support <rtc> properly).
  // Inner ruby = first operator's side, outer ruby = opposite side.
  // See: https://www.w3.org/International/articles/ruby/styling.en.html
  const innerPos = op === "^^" ? "ls-ruby-over" : "ls-ruby-under";
  const outerPos = op === "^^" ? "ls-ruby-under" : "ls-ruby-over";
  return (
    `<ruby class="ls-ruby ${outerPos} ls-ruby-double">` +
    `<ruby class="ls-ruby ${innerPos}">${safeBase}<rp>(</rp><rt>${capped[0]}</rt><rp>)</rp></ruby>` +
    `<rp>(</rp><rt>${capped[1]}</rt><rp>)</rp>` +
    `</ruby>`
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
  const result = content.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `\x00CODE${idx}\x00`;
  });
  return { result, tokens };
}

function restoreCode(content: string, tokens: string[]): string {
  let result = content;
  for (let i = 0; i < tokens.length; i++) {
    result = result.split(`\x00CODE${i}\x00`).join(tokens[i]);
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
 * Convert `^^()` / `^_()` markup to HTML.
 */
export function rubyToHTML(input: string): string {
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
      if (open >= 0) {
        baseStart = open;
        baseHtml = input.slice(open + 1, opStart - 1);
      }
    } else {
      let k = opStart - 1;
      while (k >= 0 && !/\s/.test(input[k])) k--;
      baseStart = k + 1;
      baseHtml = input.slice(baseStart, opStart);
    }

    if (baseStart < 0 || baseHtml.length === 0) {
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

    // --- Special pattern detection ---
    const isBouten1 = rawAnn === BOUTEN_PATTERN;
    const isBouten2 = rawAnn2 === BOUTEN_PATTERN;
    const isUnderline1 = rawAnn === UNDERLINE_PATTERN && op === "^_";
    const isUnderline2 = rawAnn2 === UNDERLINE_PATTERN && op2 === "^_";
    const isSpecial1 = isBouten1 || isUnderline1;
    const isSpecial2 = isBouten2 || isUnderline2;

    // --- Case 1: BOTH are special patterns ---
    if (isSpecial1 && isSpecial2) {
      out += input.slice(consumedFrom, baseStart);
      
      // Bouten + Underline combination
      if ((isBouten1 && isUnderline2) || (isUnderline1 && isBouten2)) {
        const boutenOp = isBouten1 ? op : op2;
        out += `<span class="ls-ruby-bouten ls-ruby-bouten-${boutenOp === "^^" ? "over" : "under"} ls-ruby-underline">${unescape(baseHtml)}</span>`;
      }
      // Bouten + Bouten (both dots)
      else if (isBouten1 && isBouten2) {
        out += renderBoutenBoth(baseHtml);
      }
      // Underline + Underline (just one underline)
      else {
        out += renderUnderline(baseHtml);
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
        out += renderUnderline(baseHtml);
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
          out += renderRubyWithUnderline(baseHtml, rubyText, op2!);
        }
      } else if (!isSpecial1 && isSpecial2) {
        // First is ruby text, second is special (bouten/underline)
        const rubyText = unescape(rawAnn);
        if (isBouten2) {
          out += renderRubyWithBouten(baseHtml, rubyText, op, op2!);
        } else {
          out += renderRubyWithUnderline(baseHtml, rubyText, op);
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

    out += input.slice(consumedFrom, baseStart);
    out += renderRuby(baseHtml, op, levels);
    i = finalEnd;
  }

  return out;
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
      if (open >= 0) {
        baseStart = open;
        baseHtml = input.slice(open + 1, opStart - 1);
      }
    } else {
      let k = opStart - 1;
      while (k >= 0 && !/\s/.test(input[k])) k--;
      baseStart = k + 1;
      baseHtml = input.slice(baseStart, opStart);
    }

    if (baseStart < 0 || baseHtml.length === 0) {
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

      const innerRuby = ruby.querySelector(":scope > ruby");
      if (innerRuby) {
        const outerRts = Array.from(ruby.querySelectorAll(":scope > rt")).map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);
        const innerClone = innerRuby.cloneNode(true) as HTMLElement;
        innerClone.querySelectorAll("rt, rp").forEach((n) => n.remove());
        const base = (innerClone.textContent ?? "").trim();
        const innerRts = Array.from(innerRuby.querySelectorAll(":scope > rt")).map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);
        const levels = [...innerRts, ...outerRts].filter(Boolean);
        const ann = levels.join("|");
        if (ann) ruby.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ${ann}}}`));
        continue;
      }

      const baseClone = ruby.cloneNode(true) as HTMLElement;
      baseClone.querySelectorAll("rt, rp, rtc").forEach((n) => n.remove());
      const base = (baseClone.textContent ?? "").trim();
      const rts = Array.from(ruby.querySelectorAll(":scope > rt")).map(
        (rt) => (rt.textContent ?? "").trim()
      );
      const rtcs = Array.from(ruby.querySelectorAll(":scope > rtc")).map(
        (rtc) => (rtc.textContent ?? "").trim()
      );
      const levels = [...rts, ...rtcs].filter(Boolean);
      const ann = levels.join("|");
      if (ann) ruby.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, ${ann}}}`));
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
    span.replaceWith(root.ownerDocument.createTextNode(`{{renderer :ruby, ${base}, .-, under}}`));
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

      // Nested double-level?
      const innerRuby = ruby.querySelector(":scope > ruby");
      if (innerRuby) {
        const outerRts = Array.from(ruby.querySelectorAll(":scope > rt")).map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);

        const innerClone = innerRuby.cloneNode(true) as HTMLElement;
        innerClone.querySelectorAll("rt, rp").forEach((n) => n.remove());
        const base = (innerClone.textContent ?? "").trim();
        const innerRts = Array.from(innerRuby.querySelectorAll(":scope > rt")).map(
          (rt) => (rt.textContent ?? "").trim()
        ).filter(Boolean);

        const levels = [...innerRts, ...outerRts].filter(Boolean);
        const ann = levels.join("|");
        ruby.replaceWith(doc.createTextNode(ann ? `[${base}]^^(${ann})` : base));
        continue;
      }

      // Simple ruby (single-level or legacy <rtc>)
      const baseClone = ruby.cloneNode(true) as HTMLElement;
      baseClone.querySelectorAll("rt, rp, rtc").forEach((n) => n.remove());
      const base = (baseClone.textContent ?? "").trim();

      const rts = Array.from(ruby.querySelectorAll(":scope > rt")).map(
        (rt) => (rt.textContent ?? "").trim()
      );
      const rtcs = Array.from(ruby.querySelectorAll(":scope > rtc")).map(
        (rtc) => (rtc.textContent ?? "").trim()
      );
      const levels = [...rts, ...rtcs].filter(Boolean);
      const ann = levels.join("|");
      ruby.replaceWith(doc.createTextNode(ann ? `[${base}]^^(${ann})` : base));
    }
    rubies = Array.from(root.querySelectorAll("ruby"));
  }

  for (const span of Array.from(root.querySelectorAll("span.ls-ruby-bouten"))) {
    const base = (span.textContent ?? "").trim();
    if (!base) continue;
    const isOver = span.classList.contains("ls-ruby-bouten-over");
    const isUnder = span.classList.contains("ls-ruby-bouten-under");
    const isUnderline = span.classList.contains("ls-ruby-underline");
    
    // Bouten + Underline combinations
    if (isUnderline && isOver) {
      span.replaceWith(doc.createTextNode(`[${base}]^^(..)^_(.-)`));
    } else if (isUnderline && isUnder) {
      span.replaceWith(doc.createTextNode(`[${base}]^_(.-)^^(..)`));
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
    span.replaceWith(doc.createTextNode(`[${base}]^_(.-)`));
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

    const protectRe = /<(code|pre|a |a>|ruby|script|style)[\s\S]*?<\/\1>/gi;
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
  if (rawAnn === UNDERLINE_PATTERN && op === "^_") return renderUnderline(base);

  const levels = splitByUnescapedPipe(rawAnn).map(unescape);
  return renderRuby(base, op, levels);
}
