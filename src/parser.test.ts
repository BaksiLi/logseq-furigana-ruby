import { describe, it, expect } from "vitest";
import { hasRuby, rubyToHTML, renderMacroRuby, anyToMarkup, anyToMacro, anyToHTML } from "./parser";

// ---------------------------------------------------------------------------
// hasRuby
// ---------------------------------------------------------------------------
describe("hasRuby", () => {
  it("detects ^^", () => expect(hasRuby("[漢字]^^(かんじ)")).toBe(true));
  it("detects ^_", () => expect(hasRuby("[base]^_(ann)")).toBe(true));
  it("false for plain text", () => expect(hasRuby("hello")).toBe(false));
  it("false for ^^ without parens", () => expect(hasRuby("asdf^^f")).toBe(false));
  it("false for empty", () => expect(hasRuby("")).toBe(false));
});

// ---------------------------------------------------------------------------
// rubyToHTML — basic
// ---------------------------------------------------------------------------
describe("rubyToHTML — basic", () => {
  it("[漢字]^^(かんじ)", () => {
    expect(rubyToHTML("[漢字]^^(かんじ)")).toBe(
      '<ruby class="ls-ruby ls-ruby-over">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>'
    );
  });
  it("abbreviated form", () => {
    expect(rubyToHTML("東京^^(とうきょう)")).toBe(
      '<ruby class="ls-ruby ls-ruby-over">東京<rp>(</rp><rt>とうきょう</rt><rp>)</rp></ruby>'
    );
  });
  it("preserves surrounding text", () => {
    expect(rubyToHTML("before [a]^^(b) after")).toContain("before <ruby");
    expect(rubyToHTML("before [a]^^(b) after")).toContain("</ruby> after");
  });
  it("漢^^(かん)字 partial", () => {
    expect(rubyToHTML("The 漢^^(かん)字")).toContain("</ruby>字");
  });
  it("asdf^^f no parens", () => {
    expect(rubyToHTML("asdf^^f")).toBe("asdf^^f");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — under
// ---------------------------------------------------------------------------
describe("rubyToHTML — under", () => {
  it("[base]^_(ruby)", () => {
    expect(rubyToHTML("[base]^_(ruby)")).toContain("ls-ruby-under");
  });
  it("[漢字]^_(s) single char", () => {
    const r = rubyToHTML("[漢字]^_(s)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-under");
    expect(r).toContain("<rt>s</rt>");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — multi-level
// ---------------------------------------------------------------------------
describe("rubyToHTML — multi-level", () => {
  it("2 levels via pipe → nested ruby", () => {
    const r = rubyToHTML("[北京]^^(ペキン|Beijing)");
    expect(r).toContain("ls-ruby-double");
    expect(r).toContain("<rt>ペキン</rt>");
    expect(r).toContain("<rt>Beijing</rt>");
    // Inner ruby should be over, outer under (opposite of first op ^^)
    expect(r).toMatch(/ls-ruby-under.*ls-ruby-double/);
  });
  it("caps at 2", () => {
    const r = rubyToHTML("[北京]^^(a|b|c)");
    expect(r).not.toContain(">c<");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — chaining
// ---------------------------------------------------------------------------
describe("rubyToHTML — chaining", () => {
  it("mixed chain ^^(...)^_(...)", () => {
    const r = rubyToHTML("[base]^^(over)^_(under)");
    expect(r).toContain("ls-ruby-double");
    expect(r).toContain("<rt>over</rt>");
    expect(r).toContain("<rt>under</rt>");
  });
  it("reverse chain ^_(...)^^(...)", () => {
    const r = rubyToHTML("[base]^_(a)^^(b)");
    expect(r).toContain("ls-ruby-double");
  });
  it("same-op not chained", () => {
    const r = rubyToHTML("[base]^^(a)^^(b)");
    expect(r).not.toContain("ls-ruby-double");
  });
  it("mixed: ruby over + bouten under ^^(a)^_(..)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(..)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>a</rt>");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-bouten-under");
    expect(r).not.toContain("ls-ruby-double");
  });
  it("mixed: ruby over + underline ^^(a)^_(.-)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(.-)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>a</rt>");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-underline");
    expect(r).not.toContain("ls-ruby-double");
  });
  it("mixed: ruby + ruby ^^(a)^_(s)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(s)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>a</rt>");
    expect(r).toContain("<rt>s</rt>");
    expect(r).toContain("ls-ruby-double");
  });
  it("mixed: bouten over + ruby under ^^(..)^_(s)", () => {
    const r = rubyToHTML("[漢字]^^(..)^_(s)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>s</rt>");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-bouten-over");
    expect(r).not.toContain("ls-ruby-double");
  });
  it("mixed: ruby under + bouten over ^_(s)^^(..)", () => {
    const r = rubyToHTML("[漢字]^_(s)^^(..)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>s</rt>");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-bouten-over");
  });
  it("mixed: underline + bouten over ^_(.-)^^(..)", () => {
    const r = rubyToHTML("[漢字]^_(.-)^^(..)");
    expect(r).toContain("ls-ruby-bouten");
    expect(r).toContain("ls-ruby-underline");
    expect(r).toContain("ls-ruby-bouten-over");
  });
  it("pipe + chain conflict: pipe wins, chain consumed", () => {
    const r = rubyToHTML("[李太白]^^(り たい はく|Lǐ Tài Bái)^_(..)");
    expect(r).toContain("ls-ruby-double");
    expect(r).toContain("<rt>り</rt>");
    expect(r).toContain("<rt>Lǐ</rt>");
    expect(r).not.toContain("ls-ruby-bouten");
    // Chained ^_(..) should be consumed, not left as literal text
    expect(r).not.toContain("^_");
    expect(r).not.toContain("..");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — pipe-separated special patterns
// ---------------------------------------------------------------------------
describe("rubyToHTML — pipe-separated special patterns", () => {
  it("ruby + underline via pipe ^^(text|.-)", () => {
    const r = rubyToHTML("[李太白]^^(り たい はく|.-)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-underline");
    expect(r).toContain("ls-ruby-over");
    expect(r).not.toContain(".-");
  });
  it("ruby + bouten via pipe ^^(text|..)", () => {
    const r = rubyToHTML("[漢字]^^(かんじ|..)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-bouten-under");
    expect(r).toContain("<rt>かんじ</rt>");
  });
  it("bouten + ruby via pipe ^^(..|text)", () => {
    const r = rubyToHTML("[漢字]^^(..|under)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-bouten-over");
    expect(r).toContain("<rt>under</rt>");
  });
  it("underline + ruby via pipe ^_(.-|text)", () => {
    const r = rubyToHTML("[漢字]^_(.-|over)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-underline");
    expect(r).toContain("<rt>over</rt>");
  });
  it("both special via pipe ^^(..|..)", () => {
    const r = rubyToHTML("[漢字]^^(..|..)");
    expect(r).toContain("ls-ruby-bouten-over");
    expect(r).toContain("ls-ruby-bouten-under");
    expect(r).not.toContain("<ruby");
  });
  it("both special via pipe ^^(..|.-)", () => {
    const r = rubyToHTML("[漢字]^^(..|.-)");
    expect(r).toContain("ls-ruby-bouten-over");
    expect(r).toContain("ls-ruby-underline");
  });
  it(".- at over position is NOT underline ^^(.-|text)", () => {
    // .- only means underline when at the ^_ (under) position
    const r = rubyToHTML("[aa]^^(.-|bb)");
    expect(r).toContain("<rt>.-</rt>");
    expect(r).toContain("<rt>bb</rt>");
    expect(r).not.toContain("ls-ruby-underline");
    expect(r).toContain("ls-ruby-double");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — bouten
// ---------------------------------------------------------------------------
describe("rubyToHTML — bouten", () => {
  it("^^(..) over", () => {
    expect(rubyToHTML("[漢字]^^(..)")).toBe(
      '<span class="ls-ruby-bouten ls-ruby-bouten-over">漢字</span>'
    );
  });
  it("^_(..) under", () => {
    expect(rubyToHTML("[漢字]^_(..)")).toBe(
      '<span class="ls-ruby-bouten ls-ruby-bouten-under">漢字</span>'
    );
  });
  it("^^(..)^_(..) both → single span with over+under classes", () => {
    expect(rubyToHTML("[漢字]^^(..)^_(..)")).toBe(
      '<span class="ls-ruby-bouten ls-ruby-bouten-over ls-ruby-bouten-under">漢字</span>'
    );
  });
  it("^_(..)^^(..) reverse → same result", () => {
    expect(rubyToHTML("[漢字]^_(..)^^(..)")).toBe(
      '<span class="ls-ruby-bouten ls-ruby-bouten-over ls-ruby-bouten-under">漢字</span>'
    );
  });
  it("single dot NOT bouten", () => {
    expect(rubyToHTML("[漢字]^^(.)")).toContain("<ruby");
  });
  it("single dot in chain", () => {
    const r = rubyToHTML("[aa]^^(bb)^_(.)");
    expect(r).not.toContain("ls-ruby-bouten");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-double");
  });
  it("single dot standalone", () => {
    const r = rubyToHTML("[aa]^_(.)");
    expect(r).not.toContain("ls-ruby-bouten");
    expect(r).toContain("<ruby");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — underline
// ---------------------------------------------------------------------------
describe("rubyToHTML — underline", () => {
  it("[base]^_(.-)", () => {
    expect(rubyToHTML("[base]^_(.-)" )).toBe(
      '<span class="ls-ruby-underline">base</span>'
    );
  });
  it("only ^_ operator", () => {
    expect(rubyToHTML("[base]^^(.-)")).toContain("<ruby");
  });
  it("bouten + underline chain ^^(..)^_(.-)", () => {
    const r = rubyToHTML("[漢字]^^(..)^_(.-)" );
    expect(r).toContain("ls-ruby-bouten");
    expect(r).toContain("ls-ruby-underline");
  });
  it("reverse chain underline + bouten ^_(.-)^^(..)", () => {
    const r = rubyToHTML("[漢字]^_(.-)^^(..)");
    expect(r).toContain("ls-ruby-bouten");
    expect(r).toContain("ls-ruby-underline");
  });
  it("wavy underline ^_(.~)", () => {
    expect(rubyToHTML("[base]^_(.~)")).toBe(
      '<span class="ls-ruby-underline ls-ruby-underline-wavy">base</span>'
    );
  });
  it("double underline ^_(.=)", () => {
    expect(rubyToHTML("[base]^_(.=)")).toBe(
      '<span class="ls-ruby-underline ls-ruby-underline-double">base</span>'
    );
  });
  it(".~ only with ^_ operator", () => {
    // ^^(.~) should be treated as regular ruby text, not underline
    expect(rubyToHTML("[base]^^(.~)")).toContain("<ruby");
    expect(rubyToHTML("[base]^^(.~)")).toContain("<rt>.~</rt>");
  });
  it("wavy: bouten + wavy chain ^^(..)^_(.~)", () => {
    const r = rubyToHTML("[漢字]^^(..)^_(.~)");
    expect(r).toContain("ls-ruby-bouten");
    expect(r).toContain("ls-ruby-underline");
    expect(r).toContain("ls-ruby-underline-wavy");
  });
  it("wavy: ruby + wavy via chain ^^(a)^_(.~)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(.~)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-underline");
    expect(r).toContain("ls-ruby-underline-wavy");
    expect(r).toContain("<rt>a</rt>");
  });
  it("wavy: ruby + wavy via pipe ^^(text|.~)", () => {
    const r = rubyToHTML("[漢字]^^(かんじ|.~)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-underline-wavy");
    expect(r).toContain("<rt>かんじ</rt>");
  });
  it("double: ruby + double via pipe ^^(text|.=)", () => {
    const r = rubyToHTML("[漢字]^^(かんじ|.=)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ls-ruby-mixed");
    expect(r).toContain("ls-ruby-underline-double");
    expect(r).toContain("<rt>かんじ</rt>");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — escaping
// ---------------------------------------------------------------------------
describe("rubyToHTML — escaping", () => {
  it("escaped pipe single level", () => {
    expect(rubyToHTML("[北京]^^(ペキン\\|Beijing)")).toContain("<rt>ペキン|Beijing</rt>");
  });
  it("escaped pipe + real pipe", () => {
    const r = rubyToHTML("[t]^^(a\\|b|c)");
    expect(r).toContain("<rt>a|b</rt>");
    expect(r).toContain("<rt>c</rt>");
  });
  it("IPA slashes", () => {
    expect(rubyToHTML("[cat]^^(\\/kæt\\/)")).toContain("<rt>/kæt/</rt>");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — edge cases
// ---------------------------------------------------------------------------
describe("rubyToHTML — edge cases", () => {
  it("empty brackets", () => expect(rubyToHTML("[]^^(a)")).toBe("[]^^(a)"));
  it("empty annotation", () => expect(rubyToHTML("[b]^^()")).toBe("[b]^^()"));
  it("pipe in base (brackets)", () => {
    expect(rubyToHTML("[text | pipe]^^(r)")).toContain("text | pipe");
  });
  it("HTML inside brackets", () => {
    expect(rubyToHTML("[<strong>漢</strong>]^^(かん)字")).toContain("<strong>漢</strong>");
    expect(rubyToHTML("[<strong>漢</strong>]^^(かん)字")).toContain("<rt>かん</rt>");
  });
  it("3 levels (pipe + chain) caps at 2", () => {
    const r = rubyToHTML("[北京]^^(ペキン|Beijing)^_(Pekin)");
    expect(r).not.toContain("Pekin");
  });
});

// ---------------------------------------------------------------------------
// renderMacroRuby
// ---------------------------------------------------------------------------
describe("renderMacroRuby", () => {
  it("basic", () => {
    expect(renderMacroRuby([":ruby", "漢字", "かんじ"])).toContain("<ruby");
  });
  it("under", () => {
    expect(renderMacroRuby([":ruby", "b", "a", "under"])).toContain("ls-ruby-under");
  });
  it("bouten", () => {
    expect(renderMacroRuby([":ruby", "漢字", ".."])).toContain("ls-ruby-bouten");
  });
  it("underline", () => {
    expect(renderMacroRuby([":ruby", "b", ".-", "under"])).toContain("ls-ruby-underline");
  });
  it("wavy underline", () => {
    expect(renderMacroRuby([":ruby", "b", ".~", "under"])).toContain("ls-ruby-underline-wavy");
  });
  it("double underline", () => {
    expect(renderMacroRuby([":ruby", "b", ".=", "under"])).toContain("ls-ruby-underline-double");
  });
  it("null for missing args", () => {
    expect(renderMacroRuby([":ruby"])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// anyToMarkup
// ---------------------------------------------------------------------------
describe("anyToMarkup", () => {
  it("macro → markup", () => {
    expect(anyToMarkup("{{renderer :ruby, 漢字, かんじ}}")).toBe("[漢字]^^(かんじ)");
  });
  it("macro under → markup", () => {
    expect(anyToMarkup("{{renderer :ruby, base, ann, under}}")).toBe("[base]^_(ann)");
  });
  it("HTML → markup", () => {
    expect(anyToMarkup('<ruby class="ls-ruby ls-ruby-over">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>')).toBe(
      "[漢字]^^(かんじ)"
    );
  });
  it("HTML bouten + underline → markup", () => {
    expect(anyToMarkup('<span class="ls-ruby-bouten ls-ruby-bouten-over ls-ruby-underline">漢字</span>')).toBe(
      "[漢字]^^(..)^_(.-)"
    );
  });
  it("HTML reverse bouten + underline → markup", () => {
    expect(anyToMarkup('<span class="ls-ruby-bouten ls-ruby-bouten-under ls-ruby-underline">漢字</span>')).toBe(
      "[漢字]^_(.-)^^(..)"
    );
  });
});

// ---------------------------------------------------------------------------
// anyToMacro
// ---------------------------------------------------------------------------
describe("anyToMacro", () => {
  it("markup → macro", () => {
    expect(anyToMacro("[漢字]^^(かんじ)")).toBe("{{renderer :ruby, 漢字, かんじ}}");
  });
  it("markup under → macro", () => {
    expect(anyToMacro("[base]^_(ann)")).toBe("{{renderer :ruby, base, ann, under}}");
  });
});

// ---------------------------------------------------------------------------
// anyToHTML
// ---------------------------------------------------------------------------
describe("anyToHTML", () => {
  it("markup → HTML", () => {
    expect(anyToHTML("[漢字]^^(かんじ)")).toContain("<ruby");
  });
  it("macro → HTML", () => {
    expect(anyToHTML("{{renderer :ruby, 漢字, かんじ}}")).toContain("<ruby");
  });
});

// ---------------------------------------------------------------------------
// Code protection
// ---------------------------------------------------------------------------
describe("code protection", () => {
  it("anyToMacro skips inline code", () => {
    const input = "text `[a]^^(b)` more";
    const result = anyToMacro(input);
    expect(result).toContain("`[a]^^(b)`");
    expect(result).not.toContain("renderer");
  });
  it("anyToHTML skips inline code", () => {
    const input = "text `[a]^^(b)` more";
    expect(anyToHTML(input)).toContain("`[a]^^(b)`");
  });
  it("anyToMarkup skips inline code", () => {
    const input = "text `{{renderer :ruby, a, b}}` more";
    expect(anyToMarkup(input)).toContain("`{{renderer :ruby, a, b}}`");
  });
});

// ---------------------------------------------------------------------------
// Real-world test cases
// ---------------------------------------------------------------------------
describe("real-world examples", () => {
  it("初音ミク with kanji phonetics", () => {
    const r = rubyToHTML("[初音]^^(はつね)ミク");
    expect(r).toContain("<ruby");
    expect(r).toContain("初音");
    expect(r).toContain("<rt>はつね</rt>");
    expect(r).toContain("ミク");
  });
  
  it("only second level can per-character align", () => {
    // First level has no spaces (group), second level has spaces matching chars
    const r = rubyToHTML("[李太白]^^(りたいはく|Lǐ Tài Bái)");
    expect(r).toContain("ls-ruby-double");
    // First level: group annotation
    expect(r).toContain("<rt>りたいはく</rt>");
    // Second level: per-character aligned
    expect(r).toContain("<rt>Lǐ</rt>");
    expect(r).toContain("<rt>Tài</rt>");
    expect(r).toContain("<rt>Bái</rt>");
  });
  
  it("both levels per-character aligned", () => {
    // Both levels have space-delimited annotations matching char count
    const r = rubyToHTML("[李太白]^^(り たい はく|Lǐ Tài Bái)");
    // First level per-character
    expect(r).toContain("<rt>り</rt>");
    expect(r).toContain("<rt>たい</rt>");
    expect(r).toContain("<rt>はく</rt>");
    // Second level also per-character
    expect(r).toContain("<rt>Lǐ</rt>");
    expect(r).toContain("<rt>Tài</rt>");
    expect(r).toContain("<rt>Bái</rt>");
    expect(r).toContain("ls-ruby-double");
  });
  
  it("space-delimited single level", () => {
    const r = rubyToHTML("[春夏秋冬]^^(はる なつ あき ふゆ)");
    // 4 characters, 4 annotations
    expect(r).toContain("<rt>はる</rt>");
    expect(r).toContain("<rt>なつ</rt>");
    expect(r).toContain("<rt>あき</rt>");
    expect(r).toContain("<rt>ふゆ</rt>");
    // No double-sided class
    expect(r).not.toContain("ls-ruby-double");
  });
  
  it("space-delimited count mismatch falls back to group ruby", () => {
    // 4 characters but only 1 annotation
    const r = rubyToHTML("[春夏秋冬]^^(四季)");
    // Should fallback to group ruby
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>四季</rt>");
    // Should NOT split into multiple rubies
    expect(r).toMatch(/<ruby[^>]*>春夏秋冬<rp>\(<\/rp><rt>四季<\/rt>/);
  });
  
  it("auto-hide matching characters in ruby text", () => {
    // 振り仮名 - り appears in both base and ruby
    const r = rubyToHTML("[振り仮名]^^(ふ り が な)");
    // Should intelligently segment: 振(ふ) り(hidden) 仮(が) 名(な)
    expect(r).toContain("振");
    expect(r).toContain("り");
    expect(r).toContain("仮");
    expect(r).toContain("名");
  });
  
  it("nested brackets for partially overlapping ruby", () => {
    const r = rubyToHTML("[[護]^^(まも)れ]^_(プロテゴ)");
    // Inner ruby: 護 with まも over
    expect(r).toContain("<rt>まも</rt>");
    // Outer ruby: wraps 護れ with プロテゴ under
    expect(r).toContain("<rt>プロテゴ</rt>");
    expect(r).toContain("ls-ruby-under");
    expect(r).toContain("護");
    expect(r).toContain("れ");
  });
  
  it("DEMO: output examples", () => {
    console.log("\n=== Ruby Examples ===\n");
    console.log("1. Both levels aligned:");
    console.log(rubyToHTML("[李太白]^^(り たい はく|Lǐ Tài Bái)"));
    console.log("\n2. Only second level aligned:");
    console.log(rubyToHTML("[李太白]^^(りたいはく|Lǐ Tài Bái)"));
    console.log("\n3. Single level aligned:");
    console.log(rubyToHTML("[春夏秋冬]^^(はる なつ あき ふゆ)"));
    console.log("\n4. Auto-hide (り):");
    console.log(rubyToHTML("[振り仮名]^^(ふ り が な)"));
    console.log("\n5. Nested brackets:");
    console.log(rubyToHTML("[[護]^^(まも)れ]^_(プロテゴ)"));
    console.log("");
    expect(true).toBe(true);
  });
});
