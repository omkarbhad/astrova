# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Redesign the Astrova homepage to match the approved v3 mockup — dual-gradient cinematic (purple + amber), with a faux UI skeleton showing the real Vedic chart app.

**Architecture:** All changes are confined to `HomePage.tsx` and `stars-background.tsx`. The faux UI is a pure CSS/SVG skeleton embedded in the homepage — no new dependencies needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React, existing stars/orbs components.

---

## Chunk 1: Background + ambient layer

**Files:**
- Modify: `src/components/landing/ui/stars-background.tsx`

- [ ] Add purple orb (top-right, 600px) and rose orb (mid-right, 300px) to `CosmicOrbs` alongside existing amber orbs, with drift animation class
- [ ] Add `drift` CSS keyframe via inline style or global style tag
- [ ] Commit: `feat: add purple/rose ambient orbs for dual-gradient aesthetic`

## Chunk 2: Hero section

**Files:**
- Modify: `src/components/landing/HomePage.tsx`

- [ ] Change bg color from `#0a0806` to `#06020a`
- [ ] Update badge: "Vedic · Jyotish · AI-Powered" with pulsing amber dot, JetBrains Mono font
- [ ] Update headline to "Your Stars," / italic purple→amber gradient "Decoded" / muted italic subline
- [ ] Update sub-copy
- [ ] Update primary CTA button to purple→amber gradient (`from-[#7c3aed] to-[#d97706]`)
- [ ] Add scroll indicator (label + animated line)
- [ ] Commit: `feat: redesign hero section with dual-gradient cinematic style`

## Chunk 3: Faux UI section

**Files:**
- Modify: `src/components/landing/HomePage.tsx`

- [ ] Replace `<img src="/image1.png" />` section with full faux UI skeleton
- [ ] App frame: purple-tinted border, dark background `#130e08`
- [ ] Top bar: logo area + center tabs (Charts/Matcher/Info, Charts active) + right icons (AI/bell/avatar)
- [ ] Main panel: Birth Details card (icon, title, user chip, Save/Delete buttons, 3-column date/time/location with skeleton dropdowns) + Generate button
- [ ] Charts row: Two North Indian Vedic SVG charts (D1 Lagna + D9 Navamsa) with colored planet labels and shimmer sweep
- [ ] AI sidebar: header (user info + credits chip), big avatar, 8 topic buttons (2×4 grid), chat composer
- [ ] Add `@keyframes shimmer` and `.sk::after` shimmer sweep CSS
- [ ] Commit: `feat: implement faux UI skeleton with Vedic charts and AI sidebar`

## Chunk 4: Features + Pricing + CTA

**Files:**
- Modify: `src/components/landing/HomePage.tsx`

- [ ] Features bento: 5 features in 3-col grid (Birth Chart span-2, Compatibility, Nakshatra, Dasha, AI Astrologer span-2) with purple/rose/amber icon accents and mini shimmer bars on span-2 cards
- [ ] Pricing: Update featured card visual to purple accent (border, gradient price, POPULAR badge with purple→amber gradient), keep data from constants.ts
- [ ] CTA: New copy "The stars have always been speaking" with italic "speaking" in purple→amber gradient
- [ ] Commit: `feat: update features bento, pricing accent, and CTA section`
