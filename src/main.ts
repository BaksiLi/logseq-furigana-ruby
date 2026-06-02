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
    ruby.ia-ruby { display: ruby; }
    ruby.ia-ruby rt { font-size: 0.6em; line-height: 1; }
    ruby.ia-ruby rtc rt { font-size: 0.6em; line-height: 1; }

    /* Single-level positioning */
    ruby.ia-ruby.ia-ruby-over { ruby-position: over; }
    ruby.ia-ruby.ia-ruby-under { ruby-position: under; }

    /* Double-level: nested ruby approach (Chromium doesn't support <rtc>).
       Outer ruby = opposite side, inner ruby = first operator's side. */
    ruby.ia-ruby.ia-ruby-double { }
    ruby.ia-ruby.ia-ruby-double > ruby { }

    /* Bouten over: real CSS text-emphasis dots */
    span.ia-bouten.ia-bouten-over {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
    }

    /* Bouten under: dotted underline (text-emphasis:under is clipped by Logseq) */
    span.ia-bouten.ia-bouten-under {
      text-decoration: underline dotted;
      text-underline-offset: 0.15em;
    }

    /* Both: text-emphasis over + dotted underline */
    span.ia-bouten.ia-bouten-over.ia-bouten-under {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
      text-decoration: underline dotted;
      text-underline-offset: 0.15em;
    }

    /* Underline from ^_(.-) / ^_(.~) / ^_(.=) */
    span.ia-underline {
      text-decoration-line: underline;
      text-underline-offset: 0.15em;
    }
    span.ia-overline {
      text-decoration-line: overline;
    }
    span.ia-underline.ia-underline-wavy { text-decoration-style: wavy; }
    span.ia-underline.ia-underline-double { text-decoration-style: double; }
    span.ia-overline.ia-overline-wavy { text-decoration-style: wavy; }
    span.ia-overline.ia-overline-double { text-decoration-style: double; }

    /* Bouten over + underline: text-emphasis dots above + underline */
    span.ia-bouten.ia-bouten-over.ia-underline {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
      text-decoration-line: underline;
      text-underline-offset: 0.15em;
    }

    /* Bouten under + underline: dotted underline becomes solid */
    span.ia-bouten.ia-bouten-under.ia-underline {
      text-decoration-line: underline;
      text-underline-offset: 0.15em;
    }

    /* Mixed: ruby annotation + bouten over */
    ruby.ia-ruby-mixed.ia-bouten-over {
      text-emphasis: filled dot;
      -webkit-text-emphasis: filled dot;
      text-emphasis-position: over right;
      -webkit-text-emphasis-position: over right;
    }

    /* Mixed: ruby annotation + bouten under (dotted underline) */
    ruby.ia-ruby-mixed.ia-bouten-under {
      text-decoration: underline dotted;
      text-underline-offset: 0.15em;
    }

    /* Mixed: ruby annotation + underline */
    ruby.ia-ruby-mixed.ia-underline {
      text-decoration-line: underline;
      text-underline-offset: 0.15em;
    }

    /* Underline style variants (apply to both span and ruby contexts) */
    .ia-underline-wavy { text-decoration-style: wavy; }
    .ia-underline-double { text-decoration-style: double; }
    .ia-overline-wavy { text-decoration-style: wavy; }
    .ia-overline-double { text-decoration-style: double; }
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
