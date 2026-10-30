# PS-700 visual QA record

Automated evidence is written to `output/playwright/ps-700/`:

- `root-light-desktop.png`
- `root-dark-desktop.png`
- `root-unauthorized-narrow.png`
- `root-authenticated-narrow.png`
- `root-200-percent-text.png`
- `root-offline.png`

Review checks: exact catalog wordmark and aspect ratio; theme-safe mark; no clipped text; no document-level horizontal overflow at 200-percent text; visible focus; status not conveyed by color alone; actionable unauthorized/offline/error recovery; no protected account context in unauthorized or offline evidence.

Human usability and assistive-technology review remain separate from automated browser evidence and must not be inferred from screenshots.

## PS-710 visual evidence

Automated evidence is written to `output/playwright/ps-710/`:

- `designer-project-lifecycle.png`
- `template-copy-default.png`
- `operator-denied.png`
- `persona-chooser.png`

The final images were inspected on 2026-10-29 for exact Plenum branding, semantic Teludens materials, a visibly local/synthetic persona chooser, readable Organization/owner/collaborator/status metadata, explicit Template Scenario defaulting, textual lifecycle state, visible action hierarchy, and omission of protected portal data in the Operator denial state. Automated axe checks pass. Independent human usability and assistive-technology acceptance remain NOT RUN.

## PS-720 visual evidence

Automated evidence is written to `output/playwright/ps-720/`:

- `publisher-release-catalog.png`
- `operator-session-detail.png`

The two images were inspected on 2026-10-29 for immutable Release provenance, clear Package action hierarchy, configured Session status/readiness, stable lifecycle navigation, readable single-column flow, and unclipped content. Automated axe evidence passes; denial-state data omission is covered by browser assertions. The independent ten-minute human test remains NOT RUN.
