# PS-800 prohibited UI patterns

Treat every item as a defect. Use this list with the installed Impeccable detector and Teludens conformance review.

- Card mosaics where every section is a bordered, rounded or shadowed card, including cards nested in cards.
- KPI/statistic rows that do not support a decision on the current view.
- Gradients, glows, glass effects, decorative blobs/background illustrations, or color/effects outside Teludens tokens.
- Fonts, sizes, weights, radii, shadows, spacing or durations outside Teludens tokens.
- Icons on every heading/list item, emojis, or icons without accessible names.
- Marketing patterns inside the tool: hero sections, centered oversized headings, welcome banners, celebratory copy, exclamation marks or “Oops”.
- Vague actions such as “Submit”, “OK”, “Continue” or “Click here” where a verb plus object is possible.
- Uniform visual weight that hides the primary job or action.
- Low-contrast text, including gray on tinted surfaces.
- Dialogs for inspector/page content, dialog stacks, or toast-only actionable errors.
- Bounce/elastic/decorative motion, hover animation on static content, or motion that delays completion.
- Loading indicators that do not identify scope, or empty states without an authorized next action.
- Placeholder/lorem content, invented production data, raw identifiers or enum keys shown as user labels.
- Truncation without a way to obtain the full value.
- Competing scroll containers, scroll traps or horizontal page scrolling.

PS-842 clarifications: one visible H1 names the current page/object; a workspace menu label must match its destination title. A shared participant concept retains its authored name, icon and relative order across roles. Technical identifiers, enums, digests and MIME types belong only in explicitly labeled technical disclosures, never a primary label or required free-text ID field. Visible navigation must reach every authorized workspace. At 200% desktop zoom, evaluate the 1024x768 minimum as 512x384 CSS pixels; phone screenshots alone do not establish a desktop failure. Automated results never stand in for named human/AT walkthrough evidence.

