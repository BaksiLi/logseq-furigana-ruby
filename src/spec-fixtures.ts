import corpus from "./shared-html-render-fixtures.json";

export interface HtmlRenderFixtureCount {
  pattern: string;
  count: number;
}

export interface HtmlRenderFixture {
  id: string;
  category: string;
  name: string;
  assertionType: "semantic" | "rendering-policy" | "host-skip";
  input: string;
  options?: {
    spaceAlignment?: "always" | "auto" | "off";
  };
  hostSkip?: string[];
  contains?: string[];
  notContains?: string[];
  counts?: HtmlRenderFixtureCount[];
}

export interface HtmlRenderFixtureCorpus {
  version: number;
  description: string;
  fixtureTypes: Record<HtmlRenderFixture["assertionType"], string>;
  fixtureSchema: {
    commonRequired: string[];
    byAssertionType: Record<HtmlRenderFixture["assertionType"], { required: string[]; forbidden: string[] }>;
  };
  cases: HtmlRenderFixture[];
}

// Host-neutral Inline Annotation behavior. Keep this wrapper thin so the JSON
// corpus can move between markdown-it, Logseq, Obsidian, and future core tests.
export const htmlRenderFixtureCorpus = corpus as HtmlRenderFixtureCorpus;
export const htmlRenderFixtures = htmlRenderFixtureCorpus.cases;
