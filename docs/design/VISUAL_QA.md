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
