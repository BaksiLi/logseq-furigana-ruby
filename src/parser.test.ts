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
