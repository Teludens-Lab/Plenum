# Plenum Teludens design system

`teludens-design-system-v1` is the shared visual contract for Plenum. It adopts the rendered Teludens v1.3 Graphite/Mineral Sage map as the production authority. The older Electric Vermilion decision signal in `docs/TELUDENS_TOKENS.json` is retained as source history only; product code must not use it.

Import `src/tokens.css` before product styles. Components use semantic variables only. Set `data-theme="light|dark"` on `html` and `data-density="focus|standard|operations"` on a containing workflow. Focus is the accessible low-density default, Standard is the general workspace density, and Operations is reserved for monitored, expert consoles.

The shared CSS contracts cover continuous materials, controls, status, the Node/Branch/Path/Gate/State grammar, explicit scroll containers, responsive shell transformation, reduced motion, forced colors, and the official responsive wordmark. Component states are default, hover, focus-visible, active, disabled, loading, empty, error, unauthorized, and offline. Status always pairs color with text or structure.

Brand assets are exact copies of the catalog files. `Plenum. Wordmark Dark.png` appears on light materials and `Plenum. Wordmark Light.png` on dark materials. They must not be recolored, redrawn, stretched, or replaced by simulation artwork.
