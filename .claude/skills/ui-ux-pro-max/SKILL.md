---
name: ui-ux-pro-max
description: Design intelligence for professional UI/UX. Use whenever a task changes how something looks, feels, moves, or is interacted with — new pages/components, choosing styles/colors/typography, reviewing UI for UX/accessibility issues, dark-mode contrast, animation timing, or pre-launch UI quality passes. Condensed from github.com/nextlevelbuilder/ui-ux-pro-max-skill (the full CLI with searchable style/color/font databases is optional: `npm i -g ui-ux-pro-max-cli && uipro init --ai claude`).
---

# UI/UX Pro Max — quick reference

Use when the task changes how a feature **looks, is used, moves, or is interacted with**. Skip for pure backend/API/infra work.

For this repo (ClinicWorks POS): the design system lives in `pos/app.fixed.jsx` as the module-level `C` palette and the in-component `gs` style tokens. Change tokens there — never hardcode per-screen hex values.

## Priorities (check in this order)

| # | Category | Impact | Must have | Avoid |
|---|----------|--------|-----------|-------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1 body / 3:1 large, visible focus, labels on icon-only buttons | Removing focus rings; color-only meaning |
| 2 | Touch & interaction | CRITICAL | ≥44×44pt targets, ≥8px gap, pressed feedback ≤100ms, loading state on async buttons | Hover-only affordances; 0ms state snaps |
| 3 | Performance | HIGH | Reserve space (CLS<0.1), lazy-load below fold, virtualize 50+ item lists | Layout thrash; blocking spinners >1s (use skeletons) |
| 4 | Style consistency | HIGH | One style/icon family app-wide; SVG or one emoji-scale, never mixed; one primary CTA per screen | Random shadow/radius values; mixing filled+outline icons |
| 5 | Layout & responsive | HIGH | Mobile-first, 4/8px spacing rhythm, no horizontal scroll, safe-area padding under fixed bars | Fixed px widths; content under sticky bars |
| 6 | Typography & color | MEDIUM | ≥16px body on mobile, line-height 1.5–1.75, semantic color tokens, tabular figures for money/data | <12px body; gray-on-gray; raw hex in components |
| 7 | Animation | MEDIUM | 150–300ms micro-interactions, transform/opacity only, ease-out enter / ease-in exit, respect reduced-motion | Animating width/height; >500ms; decorative-only motion |
| 8 | Forms & feedback | MEDIUM | Visible labels, validate on blur, error below field with a fix path, confirm destructive actions, undo for deletes | Placeholder-as-label; errors only at top |
| 9 | Navigation | HIGH | ≤5 bottom-nav items with labels, active state highlighted, back preserves scroll/state | Icon-only nav; nav that moves between pages |
| 10 | Charts & data | LOW | Legends + tooltips, accessible palettes, empty/loading/error states | Pie >5 slices; color-only series distinction |

## Pre-delivery checklist

- [ ] Contrast: body ≥4.5:1, secondary ≥3:1 — verified in the actual (dark) theme, not assumed
- [ ] All tappables ≥44px with pressed feedback; disabled states look disabled and do nothing
- [ ] Test at 375px width and landscape; no horizontal scroll; nothing hidden behind fixed bars
- [ ] Spacing on the 4/8 grid; one radius scale; one shadow scale; tokens not ad-hoc hex
- [ ] Money/quantities use tabular numerals; numbers never reflow the layout as they tick
- [ ] Animations 150–300ms, transform/opacity only, exit ≈ 60–70% of enter, reduced-motion respected
- [ ] Every async action shows loading and ends in success/error feedback with a recovery path
- [ ] Empty states say what to do next, not just "no data"

## Style formula (Budy-style reference used by this repo)

Deep green-black background with a real green tint (not neutral gray-black) → glassy cards one step lighter with 1px translucent borders → a single mint CTA color reserved for primary actions → fully-rounded pills for buttons/chips/badges → Inter/SF with tight letter-spacing, big bold numerals → soft layered shadows, subtle top-edge light gradient on cards.
