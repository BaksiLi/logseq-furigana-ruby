import "@logseq/libs";
import {
  hasRuby,
  hasAnyRubyContent,
  replaceRubyInElement,
  renderMacroRuby,
  anyToMarkup,
  anyToMacro,
  anyToHTML,
} from "./parser";

async function main() {
  // ---------------------------------------------------------------------------
  // CSS
  // ---------------------------------------------------------------------------
  logseq.provideStyle(`
    /* Base ruby */
    ruby.ls-ruby rt { font-size: 0.6em; line-height: 1; }
    ruby.ls-ruby rtc rt { font-size: 0.6em; line-height: 1; }

    /* Single-level positioning */
    ruby.ls-ruby.ls-ruby-over { ruby-position: over; }
    ruby.ls-ruby.ls-ruby-under { ruby-position: under; }

    /* Double-level: nested ruby approach (Chromium doesn't support <rtc>).
       Outer ruby = opposite side, inner ruby = first operator's side. */
    ruby.ls-ruby.ls-ruby-double { }
    ruby.ls-ruby.ls-ruby-double > ruby { }

    /* Bouten over: real CSS text-emphasis dots */
    span.ls-ruby-bouten.ls-ruby-bouten-over {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
    }

    /* Bouten under: dotted underline (text-emphasis:under is clipped by Logseq) */
    span.ls-ruby-bouten.ls-ruby-bouten-under {
      text-decoration: underline dotted;
      text-underline-offset: 0.15em;
    }

    /* Both: text-emphasis over + dotted underline */
    span.ls-ruby-bouten.ls-ruby-bouten-over.ls-ruby-bouten-under {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
      text-decoration: underline dotted;
      text-underline-offset: 0.15em;
    }

    /* Underline from ^_(.-) */
    span.ls-ruby-underline {
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }

    /* Bouten over + underline: text-emphasis dots above + solid underline */
    span.ls-ruby-bouten.ls-ruby-bouten-over.ls-ruby-underline {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }

    /* Bouten under + underline: dotted underline becomes solid */
    span.ls-ruby-bouten.ls-ruby-bouten-under.ls-ruby-underline {
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }

    /* Mixed: ruby annotation + bouten over */
    ruby.ls-ruby-mixed.ls-ruby-bouten-over {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
    }

    /* Mixed: ruby annotation + bouten under (dotted underline) */
    ruby.ls-ruby-mixed.ls-ruby-bouten-under {
      text-decoration: underline dotted;
      text-underline-offset: 0.15em;
    }

    /* Mixed: ruby annotation + underline */
    ruby.ls-ruby-mixed.ls-ruby-underline {
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
  `);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  async function updateBlock(uuid: string, content: string) {
    // @ts-expect-error — logseq.api.update_block avoids property-loss bug
    if (logseq.api?.update_block) {
      // @ts-expect-error
      await logseq.api.update_block(uuid, content);
      return;
    }
    await logseq.Editor.updateBlock(uuid, content);
  }

  async function getTargetBlocks() {
    const selected = await logseq.Editor.getSelectedBlocks();
    if (selected && selected.length > 0) return selected;
    const current = await logseq.Editor.getCurrentBlock();
    return current ? [current] : [];
  }

  async function convertBlocks(
    fn: (content: string) => string,
    label: string
  ) {
    const blocks = await getTargetBlocks();
    let count = 0;
    for (const b of blocks) {
      if (!b?.uuid || typeof b?.content !== "string") continue;
      if (!hasAnyRubyContent(b.content)) continue;
      const next = fn(b.content);
      if (next !== b.content) {
        await updateBlock(b.uuid, next);
        count++;
      }
    }
    logseq.UI.showMsg(count > 0 ? `${label}: ${count} block(s)` : `${label}: nothing to convert`);
  }

  // ---------------------------------------------------------------------------
  // Macro renderer
  // ---------------------------------------------------------------------------
  logseq.App.onMacroRendererSlotted(({ slot, payload }) => {
    const args = payload.arguments ?? [];
    if (!args[0] || args[0].trim() !== ":ruby") return;
    const html = renderMacroRuby(args);
    if (!html) return;
    logseq.provideUI({ key: `ruby-${slot}`, slot, reset: true, template: html });
  });

  // ---------------------------------------------------------------------------
  // Slash commands: 3 conversion targets
  // ---------------------------------------------------------------------------
  logseq.Editor.registerSlashCommand("Ruby → markup", async () => {
    await convertBlocks(anyToMarkup, "→ markup");
  });

  logseq.Editor.registerSlashCommand("Ruby → macro", async () => {
    await convertBlocks(anyToMacro, "→ macro");
  });

  logseq.Editor.registerSlashCommand("Ruby → HTML (one-way)", async () => {
    await convertBlocks(anyToHTML, "→ HTML (one-way)");
  });

  // ---------------------------------------------------------------------------
  // Live rendering
  // ---------------------------------------------------------------------------
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        const el = added as HTMLElement;
        for (const block of el.querySelectorAll("div.block-content") as NodeListOf<HTMLElement>) {
          if (hasRuby(block.innerHTML)) replaceRubyInElement(block);
        }
      }
    }
  });

  observer.observe(top!.document.body, { childList: true, subtree: true });

  for (const block of top!.document.querySelectorAll("div.block-content") as NodeListOf<HTMLElement>) {
    replaceRubyInElement(block);
  }

  console.info("logseq-furigana-ruby loaded");
}

logseq.ready(main).catch(console.error);
