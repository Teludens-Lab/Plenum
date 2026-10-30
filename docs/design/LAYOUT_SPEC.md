# Entry-shell layout specification

The shell owns document scroll. Its header is a continuous surface containing the responsive wordmark, theme control, and text-labeled connection state. The main surface is capped at 75rem with a semantic introduction followed by a three-region workspace: navigation Node, empty-workspace Gate, and account Branch.

At 48–70rem the account region moves below navigation and workspace. Below 48rem all regions form one document column; no nested vertical scroll is introduced. At 200-percent root text, regions reflow and horizontal document overflow is prohibited. Studio and Runtime retain their existing internal scroll ownership.

The wordmark preserves its 2170:725 aspect ratio between 7.5rem and 10.5rem. The catalog dark asset is visible on light materials and the light asset on dark materials.

## PS-710 Project portal

The existing shell keeps document-scroll ownership. Inside the central workspace, use one vertical Path: current Organization, search/status Gate, create branch, recent Project cards, Simulation Template cards, and the Admin-only member branch. Project metadata uses a responsive two-column definition grid; at narrow width all toolbar, filter, metadata, and action regions collapse to one column without nested scrolling.
