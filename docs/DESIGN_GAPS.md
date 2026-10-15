# EngineSense – Design Gaps

> When `design.md` is silent on a UI decision, the most conservative option consistent with it is chosen and recorded here.

| # | Gap | Decision | Rationale |
|---|-----|----------|-----------|
| G1 | **Chart styling** (axes, gridlines, tooltips, legends) | Axes: `ink-subtle` (#8a8f98). Gridlines: `hairline` (#23252a). Tooltip bg: `surface-2` with `hairline-strong` border. Legend text: `ink-muted`. Series colours: primary (#5e6ad2) for first series, then desaturated tints of primary (opacity variants) — never a second chromatic hue on the dashboard chrome | design.md forbids a second chromatic accent on marketing surfaces; chart chrome is treated as UI chrome |
| G2 | **Chart series inside product panels** (spectrograms, heatmaps, confusion matrices) | Inside `product-screenshot-card` containers, use a full perceptual colour ramp (viridis/inferno for heatmaps, categorical palette for confusion matrices). This is "product UI" per design.md §547 exemption | design.md Known Gaps §547 acknowledges product UI uses richer palettes |
| G3 | **Error states** (API failure, empty data) | Background: `surface-1`. Border: `hairline`. Text: `ink-muted`. No red. Icon: a monochrome alert icon in `ink-subtle`. Retry button: `button-secondary` | design.md §545: "Form-field error and validation styling is not visible"; we avoid introducing red |
| G4 | **Loading states** | Skeleton screens using `surface-2` shimmer blocks on `surface-1` cards. Shimmer uses a subtle left-to-right opacity sweep (0.3 → 0.6 → 0.3) at 1.5s period | No loading pattern in design.md; skeleton on surface matches the card paradigm |
| G5 | **Scrollbar styling** | Thin (6px) scrollbar, thumb: `hairline-strong`, track: `canvas`. Webkit + Firefox styled | design.md silent; dark scrollbar consistent with the near-black canvas |
| G6 | **Navigation for app screens** | Left sidebar nav (56px collapsed / 220px expanded) on `surface-1` bg with `hairline` right border. Active item: `surface-2` bg + `primary` left accent bar (2px). Text: `body-sm` in `ink-muted`, active in `ink` | design.md defines `top-nav` for marketing; for a dashboard app, a sidebar is standard. Active accent uses primary per "focus ring, link emphasis" allowed use |
| G7 | **Tooltip / popover** | `surface-3` bg, `hairline-strong` border, `rounded.md`, 8px 12px padding, `body-sm` text in `ink`, shadow: none (depth via surface ladder per design.md) | Consistent with elevation §3 |
| G8 | **Badge / tag for provenance** | `status-badge` component: `surface-2` bg, `ink-muted` text, `caption` type, `rounded.pill`. For "real" vs "synthetic": same badge, different text only — no colour coding | design.md §status-badge is the closest match; no second accent colour |
| G9 | **Focus indicators** | 2px `primary-focus` (#5e69d1) outline at 50% opacity on all interactive elements | design.md §Elevation level 4 specifies this exactly |
| G10 | **Modal/dialog** | Overlay: `semantic-overlay` (#000) at 60% opacity. Dialog: `surface-1` bg, `hairline` border, `rounded.lg`, 24px padding. Close button: `button-tertiary` | Consistent with the surface ladder and overlay token |
| G11 | **Data tables** | Header row: `surface-2` bg, `eyebrow` type, `ink-muted` text. Body rows: `canvas` bg alternating with `surface-1`. Row borders: `hairline`. Hover: `surface-2` | No table component in design.md; derived from the surface ladder |
| G12 | **Gauge / meter components** | Arc gauges use `hairline-strong` track, fill in `primary`. Value text in `ink`, label in `ink-subtle` | Conservative single-accent approach |
