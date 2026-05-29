import { describe, it, expect } from "vitest";
import { hasRuby, rubyToHTML, renderMacroRuby, anyToMarkup, anyToMacro, anyToHTML, replaceRubyInElement } from "./parser";
import { htmlRenderFixtureCorpus, htmlRenderFixtures } from "./spec-fixtures";

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
// Shared spec fixtures
// ---------------------------------------------------------------------------
describe("shared spec fixture corpus", () => {
  it("is well formed", () => {
    expect(htmlRenderFixtureCorpus.version).toBe(1);
    expect(Array.isArray(htmlRenderFixtureCorpus.cases)).toBe(true);

    const ids = new Set<string>();
    for (const fixture of htmlRenderFixtureCorpus.cases) {
      expect(fixture.id).toBeTruthy();
      expect(ids.has(fixture.id)).toBe(false);
      ids.add(fixture.id);
      expect(fixture.category).toBeTruthy();
      expect(fixture.name).toBeTruthy();
      expect(typeof fixture.input).toBe("string");
      expect(
        fixture.contains.length > 0 ||
          (fixture.notContains?.length ?? 0) > 0 ||
          (fixture.counts?.length ?? 0) > 0
      ).toBe(true);
      for (const count of fixture.counts ?? []) {
        expect(count.pattern).toBeTruthy();
        expect(Number.isInteger(count.count)).toBe(true);
        expect(count.count).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("shared spec fixtures — HTML rendering", () => {
  for (const fixture of htmlRenderFixtures) {
    it(`${fixture.id}: ${fixture.name}`, () => {
      const html = rubyToHTML(fixture.input);
      for (const expected of fixture.contains) {
        expect(html).toContain(expected);
      }
      for (const excluded of fixture.notContains ?? []) {
        expect(html).not.toContain(excluded);
      }
      for (const count of fixture.counts ?? []) {
        expect(html.split(count.pattern).length - 1).toBe(count.count);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// rubyToHTML — basic
// ---------------------------------------------------------------------------
describe("rubyToHTML — basic", () => {
  it("[漢字]^^(かんじ)", () => {
    expect(rubyToHTML("[漢字]^^(かんじ)")).toBe(
      '<ruby class="ia-ruby ia-ruby-over">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>'
    );
  });
  it("abbreviated form", () => {
    expect(rubyToHTML("東京^^(とうきょう)")).toBe(
      '<ruby class="ia-ruby ia-ruby-over">東京<rp>(</rp><rt>とうきょう</rt><rp>)</rp></ruby>'
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
    expect(rubyToHTML("[base]^_(ruby)")).toContain("ia-ruby-under");
  });
  it("[漢字]^_(s) single char", () => {
    const r = rubyToHTML("[漢字]^_(s)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-under");
    expect(r).toContain("<rt>s</rt>");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — multi-level
// ---------------------------------------------------------------------------
describe("rubyToHTML — multi-level", () => {
  it("2 levels via pipe → nested ruby", () => {
    const r = rubyToHTML("[北京]^^(ペキン|Beijing)");
    expect(r).toContain("ia-ruby-double");
    expect(r).toContain("<rt>ペキン</rt>");
    expect(r).toContain("<rt>Beijing</rt>");
    // Inner ruby should be over, outer under (opposite of first op ^^)
    expect(r).toMatch(/ia-ruby-under.*ia-ruby-double/);
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
    expect(r).toContain("ia-ruby-double");
    expect(r).toContain("<rt>over</rt>");
    expect(r).toContain("<rt>under</rt>");
  });
  it("reverse chain ^_(...)^^(...)", () => {
    const r = rubyToHTML("[base]^_(a)^^(b)");
    expect(r).toContain("ia-ruby-double");
  });
  it("same-op not chained", () => {
    const r = rubyToHTML("[base]^^(a)^^(b)");
    expect(r).not.toContain("ia-ruby-double");
  });
  it("mixed: ruby over + bouten under ^^(a)^_(..)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(..)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>a</rt>");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-bouten-under");
    expect(r).not.toContain("ia-ruby-double");
  });
  it("mixed: ruby over + underline ^^(a)^_(.-)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(.-)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>a</rt>");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-underline");
    expect(r).not.toContain("ia-ruby-double");
  });
  it("mixed: ruby + ruby ^^(a)^_(s)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(s)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>a</rt>");
    expect(r).toContain("<rt>s</rt>");
    expect(r).toContain("ia-ruby-double");
  });
  it("mixed: bouten over + ruby under ^^(..)^_(s)", () => {
    const r = rubyToHTML("[漢字]^^(..)^_(s)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>s</rt>");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-bouten-over");
    expect(r).not.toContain("ia-ruby-double");
  });
  it("mixed: ruby under + bouten over ^_(s)^^(..)", () => {
    const r = rubyToHTML("[漢字]^_(s)^^(..)");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>s</rt>");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-bouten-over");
  });
  it("mixed: underline + bouten over ^_(.-)^^(..)", () => {
    const r = rubyToHTML("[漢字]^_(.-)^^(..)");
    expect(r).toContain("ia-bouten");
    expect(r).toContain("ia-underline");
    expect(r).toContain("ia-bouten-over");
  });
  it("pipe + chain conflict: pipe wins, chain consumed", () => {
    const r = rubyToHTML("[李太白]^^(り たい はく|Lǐ Tài Bái)^_(..)");
    expect(r).toContain("ia-ruby-double");
    expect(r).toContain("<rt>り</rt>");
    expect(r).toContain("<rt>Lǐ</rt>");
    expect(r).not.toContain("ia-bouten");
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
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-underline");
    expect(r).toContain("ia-ruby-over");
    expect(r).not.toContain(".-");
  });
  it("ruby + bouten via pipe ^^(text|..)", () => {
    const r = rubyToHTML("[漢字]^^(かんじ|..)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-bouten-under");
    expect(r).toContain("<rt>かんじ</rt>");
  });
  it("bouten + ruby via pipe ^^(..|text)", () => {
    const r = rubyToHTML("[漢字]^^(..|under)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-bouten-over");
    expect(r).toContain("<rt>under</rt>");
  });
  it("underline + ruby via pipe ^_(.-|text)", () => {
    const r = rubyToHTML("[漢字]^_(.-|over)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-underline");
    expect(r).toContain("<rt>over</rt>");
  });
  it("both special via pipe ^^(..|..)", () => {
    const r = rubyToHTML("[漢字]^^(..|..)");
    expect(r).toContain("ia-bouten-over");
    expect(r).toContain("ia-bouten-under");
    expect(r).not.toContain("<ruby");
  });
  it("both special via pipe ^^(..|.-)", () => {
    const r = rubyToHTML("[漢字]^^(..|.-)");
    expect(r).toContain("ia-bouten-over");
    expect(r).toContain("ia-underline");
  });
  it(".- at over position is NOT underline ^^(.-|text)", () => {
    // .- only means underline when at the ^_ (under) position
    const r = rubyToHTML("[aa]^^(.-|bb)");
    expect(r).toContain("<rt>.-</rt>");
    expect(r).toContain("<rt>bb</rt>");
    expect(r).not.toContain("ia-underline");
    expect(r).toContain("ia-ruby-double");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — bouten
// ---------------------------------------------------------------------------
describe("rubyToHTML — bouten", () => {
  it("^^(..) over", () => {
    expect(rubyToHTML("[漢字]^^(..)")).toBe(
      '<span class="ia-bouten ia-bouten-over" style="text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right">漢字</span>'
    );
  });
  it("^_(..) under", () => {
    expect(rubyToHTML("[漢字]^_(..)")).toBe(
      '<span class="ia-bouten ia-bouten-under" style="text-decoration:underline dotted;text-underline-offset:0.15em">漢字</span>'
    );
  });
  it("^^(..)^_(..) both → single span with over+under classes", () => {
    expect(rubyToHTML("[漢字]^^(..)^_(..)")).toBe(
      '<span class="ia-bouten ia-bouten-over ia-bouten-under" style="text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right;text-decoration:underline dotted;text-underline-offset:0.15em">漢字</span>'
    );
  });
  it("^_(..)^^(..) reverse → same result", () => {
    expect(rubyToHTML("[漢字]^_(..)^^(..)")).toBe(
      '<span class="ia-bouten ia-bouten-over ia-bouten-under" style="text-emphasis:filled dot;-webkit-text-emphasis:filled dot;text-emphasis-position:over right;-webkit-text-emphasis-position:over right;text-decoration:underline dotted;text-underline-offset:0.15em">漢字</span>'
    );
  });
  it("single dot NOT bouten", () => {
    expect(rubyToHTML("[漢字]^^(.)")).toContain("<ruby");
  });
  it("single dot in chain", () => {
    const r = rubyToHTML("[aa]^^(bb)^_(.)");
    expect(r).not.toContain("ia-bouten");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-double");
  });
  it("single dot standalone", () => {
    const r = rubyToHTML("[aa]^_(.)");
    expect(r).not.toContain("ia-bouten");
    expect(r).toContain("<ruby");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — underline
// ---------------------------------------------------------------------------
describe("rubyToHTML — underline", () => {
  it("[base]^_(.-)", () => {
    expect(rubyToHTML("[base]^_(.-)" )).toBe(
      '<span class="ia-underline" style="text-decoration-line:underline;text-underline-offset:0.15em">base</span>'
    );
  });
  it("only ^_ operator", () => {
    expect(rubyToHTML("[base]^^(.-)")).toContain("<ruby");
  });
  it("bouten + underline chain ^^(..)^_(.-)", () => {
    const r = rubyToHTML("[漢字]^^(..)^_(.-)" );
    expect(r).toContain("ia-bouten");
    expect(r).toContain("ia-underline");
  });
  it("reverse chain underline + bouten ^_(.-)^^(..)", () => {
    const r = rubyToHTML("[漢字]^_(.-)^^(..)");
    expect(r).toContain("ia-bouten");
    expect(r).toContain("ia-underline");
  });
  it("wavy underline ^_(.~)", () => {
    expect(rubyToHTML("[base]^_(.~)")).toBe(
      '<span class="ia-underline ia-underline-wavy" style="text-decoration-line:underline;text-underline-offset:0.15em;text-decoration-style:wavy">base</span>'
    );
  });
  it("double underline ^_(.=)", () => {
    expect(rubyToHTML("[base]^_(.=)")).toBe(
      '<span class="ia-underline ia-underline-double" style="text-decoration-line:underline;text-underline-offset:0.15em;text-decoration-style:double">base</span>'
    );
  });
  it(".~ only with ^_ operator", () => {
    // ^^(.~) should be treated as regular ruby text, not underline
    expect(rubyToHTML("[base]^^(.~)")).toContain("<ruby");
    expect(rubyToHTML("[base]^^(.~)")).toContain("<rt>.~</rt>");
  });
  it("wavy: bouten + wavy chain ^^(..)^_(.~)", () => {
    const r = rubyToHTML("[漢字]^^(..)^_(.~)");
    expect(r).toContain("ia-bouten");
    expect(r).toContain("ia-underline");
    expect(r).toContain("ia-underline-wavy");
  });
  it("wavy: ruby + wavy via chain ^^(a)^_(.~)", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(.~)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-underline");
    expect(r).toContain("ia-underline-wavy");
    expect(r).toContain("<rt>a</rt>");
  });
  it("wavy: ruby + wavy via pipe ^^(text|.~)", () => {
    const r = rubyToHTML("[漢字]^^(かんじ|.~)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-underline-wavy");
    expect(r).toContain("<rt>かんじ</rt>");
  });
  it("double: ruby + double via pipe ^^(text|.=)", () => {
    const r = rubyToHTML("[漢字]^^(かんじ|.=)");
    expect(r).toContain("<ruby");
    expect(r).toContain("ia-ruby-mixed");
    expect(r).toContain("ia-underline-double");
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
  it("HTML inside brackets is escaped", () => {
    expect(rubyToHTML("[<strong>漢</strong>]^^(かん)字")).toContain("&lt;strong&gt;漢&lt;/strong&gt;");
    expect(rubyToHTML("[<strong>漢</strong>]^^(かん)字")).toContain("<rt>かん</rt>");
  });
  it("3 levels (pipe + chain) caps at 2", () => {
    const r = rubyToHTML("[北京]^^(ペキン|Beijing)^_(Pekin)");
    expect(r).not.toContain("Pekin");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — inline-only (no newlines)
// ---------------------------------------------------------------------------
describe("rubyToHTML — inline-only", () => {
  it("newline in bracketed base rejects", () => {
    expect(rubyToHTML("[base\ntext]^^(ann)")).toBe("[base\ntext]^^(ann)");
  });
  it("newline in annotation rejects", () => {
    expect(rubyToHTML("[base]^^(ann\ntext)")).toBe("[base]^^(ann\ntext)");
  });
  it("CR in annotation rejects", () => {
    expect(rubyToHTML("[base]^^(ann\rtext)")).toBe("[base]^^(ann\rtext)");
  });
  it("CRLF in base rejects", () => {
    expect(rubyToHTML("[base\r\ntext]^^(ann)")).toBe("[base\r\ntext]^^(ann)");
  });
  it("newline in abbreviated form annotation", () => {
    expect(rubyToHTML("漢字^^(ann\ntext)")).toBe("漢字^^(ann\ntext)");
  });
});

// ---------------------------------------------------------------------------
// rubyToHTML — abbreviated form boundary
// ---------------------------------------------------------------------------
describe("rubyToHTML — abbreviated form boundary", () => {
  it("does not include [ in abbreviated base", () => {
    // With bracket-stop fix, abbreviated form stops at [,
    // so 初音ミク is the base (not [初音ミク).
    // Multi-pass then processes the outer [...]^_(Vocaloid) bracket.
    const r = rubyToHTML("[初音ミク^^(偉大なる|世界一姫様)]^_(Vocaloid)");
    // 偉大なる should be over (operator was ^^)
    expect(r).toContain("ia-ruby-over");
    expect(r).toContain("<rt>偉大なる</rt>");
    expect(r).toContain("<rt>世界一姫様</rt>");
    expect(r).toContain("<rt>Vocaloid</rt>");
    // The base text should NOT include [
    expect(r).not.toMatch(/>\[/);
  });
  it("abbreviated form stops at brackets", () => {
    const r = rubyToHTML("[text]abc^^(ann)");
    // ] stops the abbreviated scan, so base is "abc"
    expect(r).toContain("[text]");
    expect(r).toContain("<ruby");
    expect(r).toContain("<rt>ann</rt>");
  });
  it("[ stops scan — avoids [ in abbreviated base", () => {
    const r = rubyToHTML("prefix[abc^^(ann)");
    // Abbreviated form stops at [, base = "abc"
    expect(r).toContain("prefix[");
    expect(r).toContain("<ruby");
    expect(r).toContain("abc");
    expect(r).toContain("<rt>ann</rt>");
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
    expect(renderMacroRuby([":ruby", "b", "a", "under"])).toContain("ia-ruby-under");
  });
  it("bouten", () => {
    expect(renderMacroRuby([":ruby", "漢字", ".."])).toContain("ia-bouten");
  });
  it("underline", () => {
    expect(renderMacroRuby([":ruby", "b", ".-", "under"])).toContain("ia-underline");
  });
  it("wavy underline", () => {
    expect(renderMacroRuby([":ruby", "b", ".~", "under"])).toContain("ia-underline-wavy");
  });
  it("double underline", () => {
    expect(renderMacroRuby([":ruby", "b", ".=", "under"])).toContain("ia-underline-double");
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
  it("macro → markup escapes markup delimiters", () => {
    expect(anyToMarkup("{{renderer :ruby, A[B]C, a)b}}")).toBe("[A\\[B\\]C]^^(a\\)b)");
  });
  it("macro → markup preserves pipe levels while escaping level text", () => {
    expect(anyToMarkup("{{renderer :ruby, base, a\\|b|c}}")).toBe("[base]^^(a\\|b|c)");
  });
  it("HTML → markup", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-over">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>')).toBe(
      "[漢字]^^(かんじ)"
    );
  });
  it("HTML → markup escapes base and annotation delimiters", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-over">A[B]C<rp>(</rp><rt>a)b</rt><rp>)</rp></ruby>')).toBe(
      "[A\\[B\\]C]^^(a\\)b)"
    );
  });
  it("HTML → markup escapes literal pipe in single annotation", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-over">base<rp>(</rp><rt>a|b</rt><rp>)</rp></ruby>')).toBe(
      "[base]^^(a\\|b)"
    );
  });
  it("HTML under → markup preserves position", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-under">base<rp>(</rp><rt>ann</rt><rp>)</rp></ruby>')).toBe(
      "[base]^_(ann)"
    );
  });
  it("HTML double-level under-first → markup", () => {
    const html = '<ruby class="ia-ruby ia-ruby-over ia-ruby-double"><ruby class="ia-ruby ia-ruby-under">base<rp>(</rp><rt>x</rt><rp>)</rp></ruby><rp>(</rp><rt>y</rt><rp>)</rp></ruby>';
    expect(anyToMarkup(html)).toBe("[base]^_(x|y)");
  });
  it("HTML mixed ruby over + bouten under → markup", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-mixed ia-ruby-over ia-bouten-under">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>')).toBe(
      "[漢字]^^(かんじ)^_(..)"
    );
  });
  it("HTML mixed ruby under + bouten over → markup", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-mixed ia-ruby-under ia-bouten-over">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>')).toBe(
      "[漢字]^_(かんじ)^^(..)"
    );
  });
  it("HTML mixed ruby over + underline → markup", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-mixed ia-ruby-over ia-underline">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>')).toBe(
      "[漢字]^^(かんじ)^_(.-)"
    );
  });
  it("HTML mixed ruby over + wavy underline → markup", () => {
    expect(anyToMarkup('<ruby class="ia-ruby ia-ruby-mixed ia-ruby-over ia-underline ia-underline-wavy">漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>')).toBe(
      "[漢字]^^(かんじ)^_(.~)"
    );
  });
  it("HTML bouten + underline → markup", () => {
    expect(anyToMarkup('<span class="ia-bouten ia-bouten-over ia-underline">漢字</span>')).toBe(
      "[漢字]^^(..)^_(.-)"
    );
  });
  it("HTML reverse bouten + underline → markup", () => {
    expect(anyToMarkup('<span class="ia-bouten ia-bouten-under ia-underline">漢字</span>')).toBe(
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
  it("mixed ruby chain → macro pipe levels", () => {
    expect(anyToMacro("[base]^^(over)^_(under)")).toBe("{{renderer :ruby, base, over|under}}");
  });
  it("reverse mixed ruby chain → macro pipe levels with under position", () => {
    expect(anyToMacro("[base]^_(under)^^(over)")).toBe("{{renderer :ruby, base, under|over, under}}");
  });
  it("escaped literal pipe stays escaped in macro", () => {
    expect(anyToMacro("[base]^^(a\\|b)")).toBe("{{renderer :ruby, base, a\\|b}}");
  });
  it("pipe levels stay separated in macro", () => {
    expect(anyToMacro("[base]^^(a|b)")).toBe("{{renderer :ruby, base, a|b}}");
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
  it("code preserved when mixed with HTML ruby (Issue 1)", () => {
    const input = '`cat^_(/kæt/)` <ruby class="ia-ruby ia-ruby-under">cat<rp>(</rp><rt>/kæt/</rt><rp>)</rp></ruby>';
    const result = anyToMarkup(input);
    expect(result).toContain("`cat^_(/kæt/)`");
    expect(result).toContain("[cat]^_(/kæt/)");
  });
});

// ---------------------------------------------------------------------------
// Logseq host workflow fixtures
// ---------------------------------------------------------------------------
describe("Logseq host workflows", () => {
  it("anyToMacro converts multiple annotations in one block", () => {
    expect(anyToMacro("[東]^^(ひがし)[京]^^(きょう)")).toBe(
      "{{renderer :ruby, 東, ひがし}}{{renderer :ruby, 京, きょう}}"
    );
  });

  it("anyToHTML converts mixed macro and markup while preserving inline code", () => {
    const result = anyToHTML("`[skip]^^(x)` {{renderer :ruby, 漢字, かんじ}} [語]^_(word)");
    expect(result).toContain("`[skip]^^(x)`");
    expect(result).toContain("<rt>かんじ</rt>");
    expect(result).toContain("<rt>word</rt>");
    expect(result).toContain("ia-ruby-under");
  });

  it("anyToHTML preserves fenced code blocks", () => {
    const input = "```md\n[skip]^^(x)\n```\n[漢字]^^(かんじ)";
    const result = anyToHTML(input);
    expect(result).toContain("```md\n[skip]^^(x)\n```");
    expect(result).toContain("<rt>かんじ</rt>");
  });

  it("replaceRubyInElement renders raw markup beside existing rendered ruby", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<ruby class="ia-ruby ia-ruby-over">漢<rp>(</rp><rt>かん</rt><rp>)</rp></ruby> [字]^^(じ)';

    replaceRubyInElement(host);

    expect(host.querySelectorAll("ruby.ia-ruby")).toHaveLength(2);
    expect(host.innerHTML).toContain("<rt>かん</rt>");
    expect(host.innerHTML).toContain("<rt>じ</rt>");
    expect(host.innerHTML).not.toContain("[字]^^(じ)");
  });

  it("rubyToHTML does not reconsume generated HTML in same-op chains", () => {
    const result = rubyToHTML("[base]^^(a)^^(b)");
    expect(result).toContain('<ruby class="ia-ruby ia-ruby-over">base');
    expect(result).toContain("<rt>a</rt>");
    expect(result).toContain("^^(b)");
    expect(result).not.toContain('class="ia-ruby <ruby class=');
  });

  it("plain ia-* text does not trigger HTML conversion", () => {
    expect(anyToMarkup("plain ia-ruby text")).toBe("plain ia-ruby text");
    expect(anyToMacro("plain ia-bouten text")).toBe("plain ia-bouten text");
  });
});

// ---------------------------------------------------------------------------
// Inline styles portability
// ---------------------------------------------------------------------------
describe("inline styles", () => {
  it("bouten over has inline text-emphasis", () => {
    const r = rubyToHTML("[漢字]^^(..)");
    expect(r).toContain('style="');
    expect(r).toContain("text-emphasis:filled dot");
  });
  it("bouten under has inline text-decoration", () => {
    const r = rubyToHTML("[漢字]^_(..)");
    expect(r).toContain('style="');
    expect(r).toContain("text-decoration:underline dotted");
  });
  it("underline has inline style", () => {
    const r = rubyToHTML("[base]^_(.-)");
    expect(r).toContain('style="');
    expect(r).toContain("text-decoration-line:underline");
  });
  it("ruby under has inline ruby-position", () => {
    const r = rubyToHTML("[base]^_(ann)");
    expect(r).toContain('style="ruby-position:under"');
  });
  it("ruby over has no inline ruby-position", () => {
    const r = rubyToHTML("[base]^^(ann)");
    expect(r).not.toContain('style=');
  });
  it("nested ruby under has inline style", () => {
    const r = rubyToHTML("[北京]^^(Beijing|PKG)");
    expect(r).toContain('style="ruby-position:under"');
  });
  it("mixed ruby + bouten has inline styles", () => {
    const r = rubyToHTML("[漢字]^^(a)^_(..)");
    expect(r).toContain('style="');
    expect(r).toContain("text-decoration:underline dotted");
  });
});

// ---------------------------------------------------------------------------
// Auto-hide wrapping
// ---------------------------------------------------------------------------
describe("auto-hide wrapping", () => {
  it("hidden chars wrapped in empty-rt ruby (Issue 5)", () => {
    const r = rubyToHTML("[振り仮名]^^(ふ り が な)");
    // り should be wrapped in ruby with empty rt, not bare text
    expect(r).toContain('<ruby class="ia-ruby ia-ruby-over">り<rp>(</rp><rt></rt><rp>)</rp></ruby>');
    expect(r).toContain("<rt>ふ</rt>");
    expect(r).toContain("<rt>が</rt>");
    expect(r).toContain("<rt>な</rt>");
  });
  it("round-trip auto-hidden ruby back to markup", () => {
    const html = rubyToHTML("[振り仮名]^^(ふ り が な)");
    const markup = anyToMarkup(html);
    // Per-char info is baked in; り has empty annotation → bare char
    expect(markup).toContain("[振]^^(ふ)");
    expect(markup).toContain("り");
    expect(markup).toContain("[仮]^^(が)");
    expect(markup).toContain("[名]^^(な)");
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
    expect(r).toContain("ia-ruby-double");
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
    expect(r).toContain("ia-ruby-double");
  });
  
  it("space-delimited single level", () => {
    const r = rubyToHTML("[春夏秋冬]^^(はる なつ あき ふゆ)");
    // 4 characters, 4 annotations
    expect(r).toContain("<rt>はる</rt>");
    expect(r).toContain("<rt>なつ</rt>");
    expect(r).toContain("<rt>あき</rt>");
    expect(r).toContain("<rt>ふゆ</rt>");
    // No double-sided class
    expect(r).not.toContain("ia-ruby-double");
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
    expect(r).toContain("ia-ruby-under");
    expect(r).toContain("護");
    expect(r).toContain("れ");
  });
  
  it("renders demo examples without throwing", () => {
    const examples = [
      "[李太白]^^(り たい はく|Lǐ Tài Bái)",
      "[李太白]^^(りたいはく|Lǐ Tài Bái)",
      "[春夏秋冬]^^(はる なつ あき ふゆ)",
      "[振り仮名]^^(ふ り が な)",
      "[[護]^^(まも)れ]^_(プロテゴ)",
    ];

    for (const example of examples) {
      expect(rubyToHTML(example)).toContain("<ruby");
    }
  });
});
