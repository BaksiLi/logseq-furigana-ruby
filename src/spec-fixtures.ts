import corpus from "./shared-html-render-fixtures.json";

export interface HtmlRenderFixtureCount {
  pattern: string;
  count: number;
}

export interface HtmlRenderFixture {
  id: string;
  category: string;
  name: string;
  input: string;
  contains: string[];
  notContains?: string[];
  counts?: HtmlRenderFixtureCount[];
}

export interface HtmlRenderFixtureCorpus {
  version: number;
  description: string;
  cases: HtmlRenderFixture[];
}

// Host-neutral Inline Annotation behavior. Keep this wrapper thin so the JSON
// corpus can move between markdown-it, Logseq, Obsidian, and future core tests.
export const htmlRenderFixtureCorpus = corpus as HtmlRenderFixtureCorpus;
export const htmlRenderFixtures = htmlRenderFixtureCorpus.cases;
