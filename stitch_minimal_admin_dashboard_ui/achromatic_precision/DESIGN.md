---
name: Achromatic Precision
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5d5e66'
  on-secondary: '#ffffff'
  secondary-container: '#e3e1ec'
  on-secondary-container: '#63646c'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1d'
  on-tertiary-container: '#838485'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e3e1ec'
  secondary-fixed-dim: '#c6c5cf'
  on-secondary-fixed: '#1a1b22'
  on-secondary-fixed-variant: '#46464e'
  tertiary-fixed: '#e2e2e3'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1d'
  on-tertiary-fixed-variant: '#454748'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is centered on a "Hyper-Minimalist" aesthetic, prioritizing extreme clarity, white space, and a high-contrast monochrome palette. The goal is to evoke a sense of professional transparency and architectural order. By stripping away non-essential color, the focus shifts entirely to content and typography.

The style leverages a "mainly white" philosophy. Surfaces are expansive and clean, using subtle tonal shifts in light grays to define hierarchy rather than heavy shadows or vibrant hues. This results in a interface that feels lightweight, fast, and intellectually honest.

## Colors

The palette is strictly monochromatic to maintain a clean, high-contrast look. 

- **Primary Canvas:** The majority of the UI resides on pure white (#ffffff).
- **Accents:** Black (#000000) is used sparingly for primary actions and key text to ensure maximum legibility and a striking visual anchor.
- **Subtle Containers:** Light grays (Zinc/Slate scales) are used to differentiate secondary zones or background fills without breaking the "mainly white" aesthetic.
- **Interactive States:** Use subtle shifts in gray (e.g., #f4f4f5 to #e4e4e7) for hover and active states to maintain a soft tactile feel.

## Typography

This design system utilizes **Inter** across all levels to maintain a systematic and utilitarian feel. 

- **Headlines:** Use tight letter spacing and bold weights to create a strong visual hierarchy against the white space.
- **Body:** Standardized at 16px for optimal readability. Use the "Zinc-700" gray for long-form text to reduce eye strain against the pure white background.
- **Labels:** Small, uppercase, and slightly tracked out to distinguish them from interactive elements and body copy.

## Layout & Spacing

The layout philosophy relies on a **Fluid Grid** with generous margins to reinforce the minimalist aesthetic.

- **Desktop:** 12-column grid with 24px gutters. Page margins are wide (64px+) to keep content centered and focused.
- **Mobile:** 4-column grid with 16px margins.
- **Rhythm:** An 8px linear scale is used for all internal component spacing. Vertical rhythm should prioritize white space over dividers; use 48px or 64px gaps between major sections to allow the UI to "breathe."

## Elevation & Depth

This design system avoids traditional heavy shadows to maintain its "clean" profile. 

- **Low-Contrast Outlines:** Use 1px borders in a soft gray (#e4e4e7) to define cards and input fields.
- **Tonal Layering:** Depth is achieved by placing white cards on a slightly off-white (#fafafa) background, or vice versa.
- **Subtle Elevation:** For floating elements like modals or dropdowns, use a single, very soft, highly diffused shadow (0px 10px 30px rgba(0,0,0,0.04)) to provide just enough separation from the base layer.

## Shapes

The shape language is consistently "Rounded" to soften the high-contrast black-and-white aesthetic.

- **Standard Elements:** Buttons, inputs, and small components use 0.5rem (8px).
- **Containers:** Cards and large sections use `rounded-lg` (16px) or `rounded-xl` (24px) to create a modern, friendly structure.
- **Circular Elements:** Avatars and status indicators should remain fully circular.

## Components

- **Buttons:** 
    - *Primary:* Solid black background with white text. Rounded (8px).
    - *Secondary:* Pure white background with a 1px light gray border.
- **Input Fields:** Pure white background, 1px border (#e4e4e7). On focus, the border darkens to primary black.
- **Cards:** White background with a 1px border. No shadow unless the card is interactive (hovering a card can trigger a very subtle shadow or a slight border color shift).
- **Chips/Badges:** Light gray background (#f4f4f5) with dark gray text. Rounded-pill shape.
- **Lists:** Use horizontal dividers only when necessary; otherwise, use vertical spacing (16px) to separate items.
- **Checkboxes/Radios:** High-contrast black fill when selected.
- **Data Tables:** Clean, no vertical lines. Use a light gray header row (#fafafa) and thin horizontal rules between entries.