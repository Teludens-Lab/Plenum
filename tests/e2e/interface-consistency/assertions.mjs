import assert from "node:assert/strict";

export async function interfaceFindings(page) {
  return page.evaluate(() => {
    const visible = (el) => !el.closest('[hidden], [aria-hidden="true"]') && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const findings = [];
    const h1 = [...document.querySelectorAll('h1')].filter(visible);
    if (h1.length !== 1) findings.push(`Expected one visible H1; found ${h1.length}`);
    if (document.documentElement.scrollWidth > innerWidth + 1) findings.push('Horizontal page overflow');
    const disclosed = (el) => el.closest('details.technical-details, details.provenance-disclosure, details.issue-technical');
    const raw = /\b(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[a-z]+(?:_[a-z0-9]+)+|(?:OPEN|DEC)-\d+|(?:sha256:)?[0-9a-f]{64}|(?:application|text|image|audio|video|font)\/[a-z0-9.+-]+)\b/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (el) => el.matches('[hidden], [aria-hidden="true"]') || getComputedStyle(el).display === "none"
        ? NodeFilter.FILTER_REJECT : visible(el) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    });
    const elements = [];
    while (walker.nextNode()) {
      const element = walker.currentNode;
      elements.push(element);
      if (!disclosed(element)) for (const text of [
        ...[...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent),
        ...(element.matches('input:not([type="password"], [type="checkbox"], [type="radio"], [type="hidden"]), textarea') ? [element.value] : []),
        ...(element.matches('select') ? [...element.selectedOptions].map((option) => option.label) : [])
      ]) {
        const found = text.match(raw);
        if (found) findings.push(`Technical primary label: ${[...new Set(found)].join(', ')}`);
      }
    }
    for (const card of document.querySelectorAll('.card .card, .workspace-card .card, [role="dialog"] .card')) {
      if (visible(card)) findings.push(`Nested card: ${card.className}`);
    }
    for (const region of document.querySelectorAll('main:not(.studio-layout), .editor-canvas, .editor-nav, .editor-inspector')) {
      if (!visible(region)) continue;
      const scrolling = elements.filter((el) => region.contains(el) && !el.matches('textarea, [contenteditable="true"]') && /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2);
      if (scrolling.length > 1) findings.push(`Competing scroll owners in ${region.className}: ${scrolling.length}`);
    }
    return [...new Set(findings)];
  });
}

export async function assertInterface(page) {
  assert.deepEqual(await interfaceFindings(page), []);
}
