---
name: Agiliza Seller Deep Space
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#45dfa4'
  on-secondary: '#003825'
  secondary-container: '#00bd85'
  on-secondary-container: '#00452e'
  tertiary: '#eec131'
  on-tertiary: '#3d2f00'
  tertiary-container: '#d0a60d'
  on-tertiary-container: '#4f3d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#68fcbf'
  secondary-fixed-dim: '#45dfa4'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffe08d'
  tertiary-fixed-dim: '#eec131'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#584400'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  mono-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin: 40px
---

## Brand & Style

The design system is engineered for high-performance e-commerce management, evoking a sense of precision, speed, and vastness. The brand personality is "The Mission Control for Sellers"—authoritative yet unobtrusive. 

The aesthetic leverages **Glassmorphism** and **Minimalism** to create a multi-layered interface that feels light despite its dark palette. The UI focuses on high data density handled through clear grouping and "breathable" negative space, mirroring the sophisticated workflows found in developer-centric tools like Linear. It relies on subtle depth, precise 1px strokes, and vibrant accent colors to guide the user's eye toward critical performance metrics and action items.

## Colors

The palette is rooted in a "Deep Space" theme. The primary background is a near-black (#0a0a0f), providing a void-like canvas that makes interactive elements pop. Surfaces and containers use a dark navy-purple (#0d1117) to provide a subtle tonal shift for hierarchy.

- **Primary (Electric Blue):** Used for primary actions, focus states, and active navigation indicators.
- **Success (Emerald Green):** Reserved for positive growth trends, completed orders, and healthy account statuses.
- **Warning/Secondary (Amber Gold):** Used for pending tasks, alerts, and secondary data visualizations that require attention.
- **Neutral/Text:** A scale of cool grays starting from white for headings down to #94a3b8 for secondary metadata.

## Typography

This design system utilizes **Inter** for its exceptional legibility in data-heavy dark mode environments. The type scale is strictly aligned to an 8px baseline grid. 

Headings use tighter letter spacing and heavier weights to maintain a strong presence against dark backgrounds. Body text is optimized for readability with generous line heights. For numerical data or SKU identifiers, use the "label" or "mono" styles to ensure clear differentiation from descriptive text. Use white (100% opacity) for headings and 70-80% opacity for body copy to maintain a clear visual hierarchy.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a fixed 12-column structure for main dashboard views. It relies on an 8px spatial system (4px, 8px, 16px, 24px, 32px, 48px, 64px).

- **Sidebar:** Fixed width (240px), semi-transparent with a background blur.
- **Gutter:** 24px to provide "breathing room" between data-dense cards.
- **Margins:** 40px external margins to frame the "Mission Control" center.
- **Alignment:** All internal card padding should default to 24px (`lg`) to ensure content doesn't feel cramped within the glass surfaces.

## Elevation & Depth

Depth is conveyed through **Glassmorphism** and tonal layering rather than traditional drop shadows.

1.  **Level 0 (Base):** The #0a0a0f background.
2.  **Level 1 (Cards/Surfaces):** Navy-purple (#0d1117) with 60-80% opacity and a 16px-20px backdrop blur. 
3.  **Borders:** Every elevated surface must have a 1px solid border with 8-10% white opacity. This creates a "light-catching" edge that defines the shape in the dark space.
4.  **Floating Elements (Modals/Tooltips):** These use a higher z-index, 100% opacity backgrounds, and a subtle electric blue outer glow (blur: 20px, opacity: 10%) to simulate light emission.

## Shapes

The design system adopts a **Rounded** shape language to soften the technical feel of the data. 

- **Cards & Modals:** 16px corner radius is the standard for all primary containers.
- **Buttons & Inputs:** 8px corner radius for a more precise, clickable appearance.
- **Status Pills:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Icons:** Use 1.5pt or 2pt stroke weights with slightly rounded joins to match the typography's character.

## Components

### Buttons
- **Primary:** Solid Electric Blue (#3b82f6) with white text. High contrast.
- **Secondary:** Transparent background with the 1px (10% white) border and white text.
- **Ghost:** No border, text-only until hover, where a subtle #ffffff (5% opacity) background appears.

### Cards
All cards must implement the glassmorphism effect: `#0d1117` at 70% opacity, 16px blur, and a 1px white border at 8% opacity. Header sections within cards should be separated by a subtle 1px divider.

### Inputs & Selects
Dark-filled (#050507) with an 8px radius. The border remains 1px white (10% opacity) in the rest state and transitions to Electric Blue (#3b82f6) on focus. Use Inter Label-md for top-aligned field labels.

### Data Tables
- **Header:** Background-less, using all-caps Label-md typography with 50% white opacity.
- **Rows:** Separated by 1px borders (#ffffff at 5% opacity). No alternating row colors; use hover states to highlight rows.

### Sidebar & Header
Persistent semi-transparent layers. The sidebar should have a 1px right-border and the header a 1px bottom-border. Navigation items use Electric Blue for active states (text and a small 2px vertical "light bar" on the left edge).