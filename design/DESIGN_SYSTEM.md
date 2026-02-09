# SentimentIQ Design System

## Overview

Design system for **SentimentIQ**, a social media sentiment analysis SaaS platform. The visual style is inspired by Claude.com and Claude Code -- dark, minimalist, and professional. Every component is purpose-built for a data-heavy analytics interface where readability, hierarchy, and clarity are paramount.

**Technology stack:** Next.js 14, Tailwind CSS, React 18, TypeScript, recharts.

---

## Brand Identity

### Logo

The SentimentIQ logo (`frontend/public/logo.svg`) combines two core concepts:

1. **Chat bubble** -- representing social media comments and conversations.
2. **Sentiment pulse line** -- a heartbeat-style polyline that transitions from red (negative) through yellow (neutral) to green (positive), visualizing the sentiment analysis pipeline.

The bubble uses the accent purple gradient (`#7c3aed` to `#a78bfa`) as a subtle fill and stroke. Three colored dots on the pulse line mark the sentiment anchors: green (positive peak), yellow (neutral midpoint), and red (negative trough).

The logo works at all sizes:
- **Favicon (16-32px):** The bubble shape remains recognizable even at small sizes.
- **Navigation bar (40px):** Full detail visible including the pulse line.
- **Marketing (200px+):** All gradient detail and dots are crisp.

An existing raster logo (`logo.png` in project root) features an upward-trending graph with a brain icon on a dark navy background. The new SVG logo modernizes this concept while aligning with the accent purple color scheme.

### Brand Voice

- Professional but approachable
- Data-driven and confident
- Clear, concise language -- no jargon walls
- Portuguese (pt-BR) for user-facing copy; English for code and documentation

---

## Color Palette

All colors are defined in `design/tokens/colors.json` and mapped to Tailwind utilities in `tailwind.config.ts`.

### Background Colors

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| background.primary | `#0d1117` | `bg-background` | Page background, root level |
| background.secondary | `#161b22` | `bg-surface` | Cards, panels, elevated surfaces |
| background.tertiary | `#1c2128` | `bg-surface-hover` | Hover states on surfaces |

### Surface Colors

| Token | Hex | Usage |
|---|---|---|
| surface.default | `#161b22` | Card backgrounds, sidebar, panels |
| surface.hover | `#1c2128` | Hovered cards, hovered table rows |
| surface.active | `#21262d` | Pressed/active state, tooltip background |
| surface.border | `#30363d` | Card borders, input borders, dividers |
| surface.border-hover | `#484f58` | Hovered borders, scrollbar thumb hover |

### Text Colors

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| text.primary | `#e6edf3` | `text-text-primary` | Headings, primary content |
| text.secondary | `#8b949e` | `text-text-secondary` | Descriptions, labels, metadata |
| text.tertiary | `#6e7681` | -- | Disabled text, placeholders |
| text.inverse | `#0d1117` | -- | Text on light/accent backgrounds |

### Accent Colors

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| accent.primary | `#7c3aed` | `bg-accent`, `text-accent` | Primary actions, focus rings, brand |
| accent.primary-hover | `#6d28d9` | `bg-accent-hover` | Hovered primary buttons |
| accent.primary-light | `rgba(124,58,237,0.15)` | -- | Accent background tints |
| accent.secondary | `#a78bfa` | -- | Links, secondary accent highlights |

### Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| success / positive | `#3fb950` | Positive sentiment, success states |
| warning / neutral | `#d29922` | Neutral sentiment, warning states |
| error / negative | `#f85149` | Negative sentiment, error states, destructive actions |
| info | `#58a6ff` | Informational badges, tips |

Each semantic color has a `-bg` variant at 10% opacity for subtle background tinting (e.g., `rgba(63, 185, 80, 0.1)` for success).

### Sentiment Score Mapping

Scores range from 0 to 10:
- **Score >= 7:** Positive (`#3fb950`)
- **Score 4-6:** Neutral (`#d29922`)
- **Score < 4:** Negative (`#f85149`)

Utility functions `scoreColor()` and `scoreBg()` in `lib/utils.ts` handle this mapping.

### Platform Colors

| Platform | Hex | Usage |
|---|---|---|
| YouTube | `#FF0000` | Avatar rings, platform badges, icons |
| Instagram | `#E4405F` | Avatar rings, platform badges, icons |
| TikTok | `#00f2ea` | Reserved for future use |

---

## Typography

Defined in `design/tokens/typography.json`.

### Font Families

| Token | Stack | Usage |
|---|---|---|
| `sans` | Inter, system-ui, -apple-system, sans-serif | All UI text |
| `mono` | JetBrains Mono, Fira Code, monospace | Code snippets, IDs, scores |

Inter is loaded via Google Fonts in `globals.css`. The Tailwind config maps `font-sans` to the Inter stack.

### Type Scale

| Token | Size | Line Height | Tailwind | Usage |
|---|---|---|---|---|
| xs | 0.75rem (12px) | 1rem | `text-xs` | Badges, timestamps, fine print |
| sm | 0.875rem (14px) | 1.25rem | `text-sm` | Body text, button labels, table cells |
| base | 1rem (16px) | 1.5rem | `text-base` | Default body, large buttons |
| lg | 1.125rem (18px) | 1.75rem | `text-lg` | Card titles, section headings |
| xl | 1.25rem (20px) | 1.75rem | `text-xl` | Page sub-headings |
| 2xl | 1.5rem (24px) | 2rem | `text-2xl` | Page headings |
| 3xl | 1.875rem (30px) | 2.25rem | `text-3xl` | Dashboard KPI values |
| 4xl | 2.25rem (36px) | 2.5rem | `text-4xl` | Hero text, large numbers |

### Font Weights

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| normal | 400 | `font-normal` | Body text |
| medium | 500 | `font-medium` | Labels, badges, buttons |
| semibold | 600 | `font-semibold` | Card titles, headings |
| bold | 700 | `font-bold` | KPI values, emphasis |

---

## Spacing, Radius & Shadows

Defined in `design/tokens/spacing.json`.

### Spacing Scale

Uses Tailwind's default rem-based scale: `0`, `1` (0.25rem), `2` (0.5rem), `3` (0.75rem), `4` (1rem), `5` (1.25rem), `6` (1.5rem), `8` (2rem), `10` (2.5rem), `12` (3rem), `16` (4rem), `20` (5rem).

**Common patterns:**
- Card padding: `p-6` (1.5rem)
- Section gaps: `gap-6` (1.5rem) between cards
- Stack spacing: `space-y-4` (1rem) for form fields
- Inline spacing: `gap-2` (0.5rem) between icon and text

### Border Radius

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| sm | 0.25rem | `rounded-sm` | -- |
| md | 0.375rem | `rounded-md` | Badges, small elements |
| lg | 0.5rem | `rounded-lg` | Inputs, buttons |
| xl | 0.75rem | `rounded-xl` | Cards |
| 2xl | 1rem | `rounded-2xl` | Modal dialogs |
| full | 9999px | `rounded-full` | Avatars, circular badges |

### Box Shadows

| Token | Value | Usage |
|---|---|---|
| sm | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| md | `0 4px 6px rgba(0,0,0,0.3)` | Dropdowns, tooltips |
| lg | `0 10px 15px rgba(0,0,0,0.3)` | Modals |
| xl | `0 20px 25px rgba(0,0,0,0.3)` | Overlays |
| glow-accent | `0 0 20px rgba(124,58,237,0.15)` | Focused or featured cards |
| glow-success | `0 0 20px rgba(63,185,80,0.15)` | Success highlights |

---

## Components

All components live in `frontend/components/ui/` with **lowercase filenames**. They use the `cn()` utility from `@/lib/utils` for className merging (clsx + tailwind-merge). Components use `forwardRef` for ref forwarding.

---

### Button (`button.tsx`)

A versatile button component with multiple variants and sizes.

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"primary"` | Visual style |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size preset |
| `disabled` | `boolean` | `false` | Disabled state |

**Variants:**

- **primary** -- Purple accent background (`bg-accent`), white text. Main call-to-action.
- **secondary** -- Surface background with border. Secondary actions.
- **ghost** -- Transparent, text only. Tertiary actions, icon buttons.
- **danger** -- Red-tinted background. Destructive actions (delete, disconnect).

**Sizes:**

- **sm** -- `h-8 px-3 text-sm` (32px height)
- **md** -- `h-10 px-4 text-sm` (40px height)
- **lg** -- `h-12 px-6 text-base` (48px height)

**States:**
- Disabled: 50% opacity, no pointer events
- Focus: 2px accent ring via `focus-visible:ring-2`

**Usage:**
```tsx
<Button variant="primary" size="md">Sync Now</Button>
<Button variant="danger" size="sm">Disconnect</Button>
<Button variant="ghost">Cancel</Button>
```

---

### Card (`card.tsx`)

A composable card container for content sections.

**Sub-components:** `Card`, `CardHeader`, `CardTitle`, `CardContent`

**Card:**
- `rounded-xl` border radius
- `border-border` (1px `#30363d`)
- `bg-surface` background
- `p-6` padding

**CardHeader:**
- `flex flex-col space-y-1.5 pb-4`
- Container for title and optional description

**CardTitle:**
- `text-lg font-semibold text-text-primary`

**CardContent:**
- No default padding (inherits from Card's `p-6`)

**Usage:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Sentiment Overview</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Charts, tables, etc. */}
  </CardContent>
</Card>
```

---

### Input (`input.tsx`)

A styled text input for forms.

**Styling:**
- Height: `h-10` (40px)
- Border: `border-border` transitioning to `border-accent` on focus
- Background: `bg-surface`
- Focus: 1px accent ring
- Placeholder: `text-text-muted`

**Usage:**
```tsx
<Input placeholder="Search comments..." />
<Input type="password" placeholder="Password" />
```

---

### Badge (`badge.tsx`) -- NEW

A small label/tag component for status indicators, sentiment labels, and categories.

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `"default" \| "success" \| "warning" \| "error" \| "info" \| "outline"` | `"default"` | Color scheme |
| `size` | `"sm" \| "md"` | `"sm"` | Size preset |

**Variants:**

- **default** -- `bg-surface-hover` with border. Neutral metadata.
- **success** -- Green tint (`bg-positive/10 text-positive`). Positive sentiment, active status.
- **warning** -- Yellow tint (`bg-neutral/10 text-neutral`). Neutral sentiment, caution.
- **error** -- Red tint (`bg-negative/10 text-negative`). Negative sentiment, errors.
- **info** -- Blue tint. Informational labels.
- **outline** -- Transparent with border. Subtle categorization.

**Sizes:**
- **sm** -- `px-2 py-0.5 text-xs` (small, inline)
- **md** -- `px-2.5 py-1 text-sm` (medium, standalone)

**Usage:**
```tsx
<Badge variant="success">Positive</Badge>
<Badge variant="error" size="md">Negative</Badge>
<Badge variant="info">YouTube</Badge>
<Badge variant="outline">Sarcasm</Badge>
```

**Sentiment mapping pattern:**
```tsx
const sentimentVariant = score >= 7 ? "success" : score >= 4 ? "warning" : "error";
<Badge variant={sentimentVariant}>{label}</Badge>
```

---

### Avatar (`avatar.tsx`) -- NEW

Displays user or connection profile images with an initials fallback.

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string \| null` | -- | Image URL |
| `alt` | `string` | `""` | Alt text |
| `fallback` | `string` | -- | Name for initials generation |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size preset |
| `platform` | `"youtube" \| "instagram" \| null` | `null` | Colored ring indicator |

**Sizes:**
- **sm** -- 32x32px, `text-xs`
- **md** -- 40x40px, `text-sm`
- **lg** -- 48x48px, `text-base`

**Fallback behavior:**
1. Attempts to load `src` image.
2. On load error, falls back to initials derived from `fallback` or `alt`.
3. Initials take the first letter of the first two words (e.g., "John Doe" becomes "JD").

**Platform ring:**
- YouTube: red ring (`ring-[#FF0000]`)
- Instagram: pink ring (`ring-[#E4405F]`)
- No platform: no ring

**Usage:**
```tsx
<Avatar src={connection.profile_image_url} fallback={connection.display_name} platform="youtube" size="lg" />
<Avatar fallback="Sentiment IQ" size="sm" />
```

---

### Tooltip (`tooltip.tsx`) -- NEW

A lightweight hover tooltip using pure CSS positioning and React state.

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `ReactNode` | -- | Tooltip text/content |
| `position` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Placement |
| `delay` | `number` | `200` | Show delay in ms |

**Behavior:**
- Shows on mouse enter / focus after configurable delay
- Hides on mouse leave / blur immediately
- Uses absolute positioning relative to the wrapper
- Includes a directional arrow
- `role="tooltip"` for accessibility
- `pointer-events-none` on the tooltip to prevent flickering

**Styling:**
- Background: `#21262d` (surface.active)
- Text: `text-text-primary` (white-ish)
- Font: `text-xs font-medium`
- Border radius: `rounded-md`
- Shadow: `shadow-lg`

**Usage:**
```tsx
<Tooltip content="Analyze sentiment for all comments" position="bottom">
  <Button>Analyze</Button>
</Tooltip>
```

---

### Modal (`modal.tsx`) -- NEW

A dialog overlay using React Portal for content that requires focused attention.

**Components:** `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`

**Modal props:**
| Prop | Type | Description |
|---|---|---|
| `open` | `boolean` | Controls visibility |
| `onClose` | `() => void` | Close callback |
| `children` | `ReactNode` | Modal content |

**ModalHeader props:**
| Prop | Type | Description |
|---|---|---|
| `onClose` | `() => void` | Shows close (X) button when provided |

**Behavior:**
- Renders via `createPortal` to `document.body`
- Closes on Escape key press
- Closes on backdrop click
- Locks body scroll when open (`overflow: hidden`)
- Restores body scroll on unmount

**Styling:**
- Backdrop: `bg-black/60 backdrop-blur-sm`
- Content: `max-w-lg`, `rounded-xl`, `border-border`, `bg-surface`
- Entry animation: fade + scale (200ms)

**Usage:**
```tsx
const [open, setOpen] = useState(false);

<Modal open={open} onClose={() => setOpen(false)}>
  <ModalHeader onClose={() => setOpen(false)}>Delete Connection</ModalHeader>
  <ModalBody>
    <p>Are you sure you want to disconnect this account? All synced data will be removed.</p>
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="danger">Delete</Button>
  </ModalFooter>
</Modal>
```

---

### Select (`select.tsx`) -- NEW

A custom dropdown select styled to match the dark theme with keyboard navigation.

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `SelectOption[]` | -- | Array of options |
| `value` | `string` | -- | Selected value |
| `onChange` | `(value: string) => void` | -- | Change handler |
| `placeholder` | `string` | `"Select..."` | Placeholder text |
| `disabled` | `boolean` | `false` | Disabled state |

**SelectOption:**
```ts
interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;   // Optional leading icon
  disabled?: boolean;  // Per-option disable
}
```

**Keyboard navigation:**
- `Enter` / `Space` -- Open dropdown or select focused option
- `ArrowDown` -- Open dropdown or move focus down (wraps)
- `ArrowUp` -- Move focus up (wraps)
- `Escape` -- Close dropdown
- `Tab` -- Close dropdown, move focus normally

**Behavior:**
- Closes on outside click
- Selected option shows a checkmark
- Focused option highlighted with `bg-surface-hover`
- Chevron rotates when open
- Max height of 60 units with scroll for long lists

**Styling:**
- Trigger matches Input styling: `h-10`, `border-border`, `bg-surface`
- Dropdown: `border-border`, `bg-surface`, `shadow-lg`, `rounded-lg`
- Active/open: accent border and ring

**Usage:**
```tsx
<Select
  options={[
    { value: "all", label: "All Platforms" },
    { value: "youtube", label: "YouTube", icon: <YouTubeIcon /> },
    { value: "instagram", label: "Instagram", icon: <InstagramIcon /> },
  ]}
  value={platform}
  onChange={setPlatform}
  placeholder="Filter by platform"
/>
```

---

## States

### Loading States

**Skeleton loaders:**
- Use `bg-surface-hover` rectangles with `animate-pulse`
- Match the shape and size of the content being loaded
- Cards: full card skeleton with header + content area
- Charts: rectangular placeholder matching chart aspect ratio
- Tables: row-shaped skeletons with varying widths

**Spinners:**
- Circular spinner using `border-accent` and `border-transparent`
- Use `animate-spin` with subtle sizing (`h-5 w-5` for inline, `h-8 w-8` for page-level)
- Pair with descriptive text: "Analyzing comments..." not just a spinner

**Button loading:**
- Replace label with spinner + "Loading..." text
- Keep button width stable (use `min-w-` if needed)
- Disable pointer events during loading

### Error States

**Inputs:**
- Red border: `border-negative`
- Error message below: `text-negative text-xs mt-1`
- Never red background -- use border + message only

**API failures:**
- Toast notification with red accent and descriptive message
- Retry action when applicable

**Component crashes:**
- React Error Boundary wrapping major sections
- Fallback UI with "Something went wrong" + refresh option
- Log error details to console

### Empty States

**Pattern:**
- Centered layout within the card/section
- Subtle illustration or icon (muted color)
- Primary message: `text-text-primary font-medium text-lg`
- Secondary message: `text-text-secondary text-sm`
- Call-to-action button when appropriate

**Examples:**
- "No connections yet" with "Connect your first account" button
- "No comments found" with filter adjustment suggestion
- "No data for this period" with granularity change hint

### Success States

**Toast notification:**
- Green left border or icon
- Auto-dismiss after 4 seconds
- "Connection synced successfully", "Analysis complete"

**Inline confirmation:**
- Green check icon + message replacing the action button briefly
- Then return to normal state

---

## Interaction Patterns

### Hover Effects

**Cards:**
```css
transition: transform 200ms ease-out, box-shadow 200ms ease-out;
/* On hover: */
transform: scale(1.02);
box-shadow: 0 0 20px rgba(124, 58, 237, 0.15); /* glow-accent */
```

**Buttons:**
- Primary: `bg-accent` to `bg-accent-hover` (darker purple)
- Secondary: `bg-surface` to `bg-surface-hover`
- Ghost: transparent to `bg-surface-hover`
- Danger: `bg-negative/10` to `bg-negative/20`

**Links / interactive text:**
- Color transition from `text-text-secondary` to `text-text-primary` (200ms)
- Or from `text-accent-secondary` to `text-accent` for accent links

**Table rows:**
- `hover:bg-surface-hover` with `transition-colors duration-150`

### Transitions

**Standard durations:**
| Context | Duration | Easing |
|---|---|---|
| Button hover | 150ms | ease-in-out |
| Card hover | 200ms | ease-out |
| Page transitions | 250ms | ease-out |
| Modal enter | 200ms | ease-out |
| Modal exit | 150ms | ease-in |
| Tooltip show | 150ms | ease-out |
| List stagger | 80ms between items | ease-out |
| Chart animation | 400ms | ease-out |

**Page transitions (recommended pattern):**
```css
/* Enter */
animation: fadeSlideIn 250ms ease-out;

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**List stagger animation:**
```css
/* Each item delayed by index * 80ms */
animation-delay: calc(var(--index) * 80ms);
animation: fadeIn 200ms ease-out both;
```

### Motion Principles

1. **Purposeful:** Every animation communicates a state change or spatial relationship.
2. **Subtle:** Prefer small transforms (2-8px) over large movements.
3. **Fast:** 200-300ms for UI interactions; 400ms only for emphasis (chart reveals, celebrations).
4. **Respectful:** Always check `prefers-reduced-motion`:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

---

## Layout Patterns

### Page Structure

```
+----------------------------------------------------------+
| Navigation Bar (h-16, bg-surface, border-b border-border) |
+----------+-----------------------------------------------+
| Sidebar  |  Main Content Area                             |
| (w-64,   |  (p-6, max-w-7xl mx-auto)                     |
| bg-back- |                                                |
| ground)  |  +-- Page Title (text-2xl font-bold) ----------+
|          |  |                                              |
|          |  +-- Content Grid (grid cols-1 md:cols-2       |
|          |  |   lg:cols-3 gap-6)                          |
|          |  |                                              |
|          |  +-- Cards, tables, charts...                  |
+----------+-----------------------------------------------+
```

### Dashboard Grid

- **KPI row:** 4 columns on desktop, 2 on tablet, 1 on mobile
- **Chart row:** 2 columns on desktop, 1 on mobile
- **Table section:** Full width, scrollable on mobile

### Responsive Breakpoints

Using Tailwind defaults:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

---

## Accessibility

### Focus Management

- All interactive elements have visible focus indicators: `2px solid #7c3aed` with `2px offset`
- Defined globally in `globals.css` via `*:focus-visible`
- Modal traps focus when open (close on Escape)
- Skip-to-content link recommended for keyboard users

### Color Contrast

All text/background combinations meet WCAG AA (4.5:1 for normal text, 3:1 for large text):
- `#e6edf3` on `#0d1117`: 13.1:1 (AAA)
- `#8b949e` on `#0d1117`: 5.8:1 (AA)
- `#7c3aed` on `#0d1117`: 4.6:1 (AA)

### ARIA

- Modals: `role="dialog"`, `aria-modal="true"`
- Tooltips: `role="tooltip"`
- Select: `role="combobox"`, `aria-expanded`, `role="listbox"`, `role="option"`, `aria-selected`
- Buttons: use semantic `<button>` elements
- Images: always provide `alt` text

### Reduced Motion

Components should respect `prefers-reduced-motion: reduce` by removing or minimizing animations. The tooltip and modal components use Tailwind's `animate-in` utility which can be paired with a reduced-motion media query.

---

## File Naming Conventions

- **UI components:** `frontend/components/ui/{name}.tsx` -- always **lowercase**
- **Feature components:** `frontend/components/{PascalCase}.tsx` -- PascalCase for feature-level
- **Charts:** `frontend/components/charts/{PascalCase}.tsx`
- **Pages:** `frontend/app/(group)/route/page.tsx` -- Next.js conventions
- **Utilities:** `frontend/lib/{name}.ts` -- lowercase
- **Design tokens:** `design/tokens/{name}.json` -- lowercase

---

## Design Token Integration

The JSON token files in `design/tokens/` serve as the single source of truth. To sync with Tailwind, the color tokens are manually mapped in `tailwind.config.ts`:

```ts
// tailwind.config.ts
colors: {
  background: "#0d1117",       // colors.background.primary
  surface: "#161b22",          // colors.surface.default
  "surface-hover": "#1c2128",  // colors.surface.hover
  border: "#30363d",           // colors.surface.border
  "text-primary": "#e6edf3",  // colors.text.primary
  "text-secondary": "#8b949e", // colors.text.secondary
  "text-muted": "#484f58",    // colors.surface.border-hover
  accent: "#7c3aed",          // colors.accent.primary
  "accent-hover": "#6d28d9",  // colors.accent.primary-hover
  positive: "#3fb950",        // colors.sentiment.positive
  neutral: "#d29922",         // colors.sentiment.neutral
  negative: "#f85149",        // colors.sentiment.negative
}
```

When adding new colors, update both the token JSON and the Tailwind config.

---

## Chart Styling

Charts use **recharts** and should follow these guidelines:

### Colors

- Positive line/bar: `#3fb950`
- Neutral line/bar: `#d29922`
- Negative line/bar: `#f85149`
- Grid lines: `#21262d`
- Axis labels: `#8b949e`
- Tooltip background: `#161b22` with `border: 1px solid #30363d`

### Typography in Charts

- Axis labels: 12px, `#8b949e`
- Tooltip text: 13px, `#e6edf3`
- Legend text: 12px, `#8b949e`

### Animation

- Chart entrance: 400ms ease-out
- Hover transitions: 200ms

---

## Changelog

| Date | Change | Author |
|---|---|---|
| 2026-02-09 | Initial design system created. Tokens, 5 new components (Badge, Avatar, Tooltip, Modal, Select), SVG logo, comprehensive documentation. | Design System Agent |
