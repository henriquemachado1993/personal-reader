---
name: Personal Reader
description: A quiet personal library with open shelves and floating reading controls.
colors:
  primary: "#252525"
  primary-hover: "#454545"
  background: "#ffffff"
  surface: "#fafafa"
  surface-secondary: "#f2f2f2"
  text: "#101010"
  text-secondary: "#737373"
  border: "#e7e7e7"
  selection: "#eaeaea"
  reader-background: "#f6f6f6"
  reader-ink: "#111"
  continue-earth: "#665942"
  continue-gray: "#626262"
  continue-olive: "#665b46"
  continue-progress: "#e5e2dd"
  bookmark: "#ed333b"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-1.1px"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.65px"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
  navigation:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "18px"
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  reader-heading:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "31px"
    fontWeight: 400
    lineHeight: 1.3
  reader-appearance:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "22px"
  reader-appearance-compact:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "20px"
  reader-pagination:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "18px"
    fontWeight: 600
  reader-pagination-compact:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 600
  reader-title-compact:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
rounded:
  thumbnail: "3px"
  field: "7px"
  card: "15px"
  chip: "18px"
  action: "24px"
  menu: "28px"
  navigation-item: "30px"
  toolbar: "32px"
  navigation: "40px"
  filmstrip: "42px"
  circle: "50%"
spacing:
  compact: "8px"
  control: "12px"
  inset: "15px"
  roomy: "20px"
  section-gap: "24px"
  shelf-gap: "32px"
  page-inset: "56px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.action}"
    padding: "11px 19px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "9px 16px"
    typography: "{typography.label}"
  search:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "8px 14px"
  filter-chip:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.chip}"
    padding: "8px 14px"
    typography: "{typography.label}"
  filter-chip-active:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.text}"
  navigation:
    rounded: "{rounded.navigation}"
    padding: "6px"
  continue-card:
    backgroundColor: "{colors.continue-earth}"
    textColor: "{colors.background}"
    rounded: "{rounded.card}"
    padding: "17px 20px"
  library-row:
    padding: "27px 0"
    typography: "{typography.title}"
  floating-circle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.circle}"
    width: "58px"
    height: "58px"
---

# Design System: Personal Reader

## Overview

**Creative North Star: "Apple Books, a personal open shelf"**

The user's supplied Apple Books references establish the visual authority: generous neutral white, strong Georgia headings, open book shelves, and a floating capsule navigation. The library should feel quiet, editorial, and spacious, with color carried mainly by document covers. This records the implemented code and rendered screens after the user rejected the first beige, dominant-sidebar interpretation.

Floating controls frame the content without enclosing every item. Large library rows make titles and authors easy to scan; the reader puts a white page at the center and groups tools into rounded floating controls. The visual system supports the product's durable commitment to discreet reading and annotations linked to their source.

**Key Characteristics:**

- Neutral white and gray chrome with dark text.
- Bold Georgia page and section headings paired with system sans-serif interface text.
- Open shelves, generous list rows, and small physical book shadows.
- Floating capsule navigation, circular menu controls, and rounded reader tools.
- Functional motion with a reduced-motion override.

## Colors

The interface uses a restrained neutral palette; document covers and annotation colors carry most of the chromatic variety.

### Primary

- **Charcoal action** (`primary`): import actions and other primary buttons; `primary-hover` supplies the lighter hover state.
- **Bookmark red** (`bookmark`): the page ribbon and active bookmark control, reserved for that reading state.

### Neutral

- **Open white** (`background`): the workspace canvas and white reader paper.
- **Floating porcelain** (`surface`): capsule controls, menus, and secondary actions.
- **Soft gray** (`surface-secondary`): search fields and quiet hover fills.
- **Editorial black** (`text`): headings and primary interface content.
- **Reading gray** (`text-secondary`): author names, metadata, and secondary controls.
- **Fine divider** (`border`): library row separators, menu divisions, and control outlines.
- **Selected gray** (`selection`): active navigation and selected filters.
- **Reader surround / reader ink** (`reader-background`, `reader-ink`): the default page surround and reading text.
- **Continue earth / gray / olive** (`continue-earth`, `continue-gray`, `continue-olive`): subdued dark continuation cards with white text; `continue-progress` supports secondary progress text.

**The Cover Color Rule.** Keep general workspace chrome neutral; let the documents supply the shelf's varied color.

The implemented dark workspace overrides background, surface, text, border, accent, and selected-state variables with neutral graphite equivalents. The reviewed screenshots establish the light appearance; dark mode has not received the same visual verification. Reader white/night preferences are separate from the workspace theme.

## Typography

**Display Font:** Georgia with Times New Roman and serif fallbacks.
**Body Font:** the platform system sans-serif stack with Segoe UI on Windows.

Georgia establishes an editorial hierarchy; the system sans-serif keeps controls and metadata compact. Page headings are bold, while reading chapter headings use regular Georgia. The library row title is sans-serif, distinct from the page heading.

### Hierarchy

- **Display:** the frontmatter display role governs page titles. It steps down to (47px) below (1100px), (43px) below (760px), and (41px) below (540px).
- **Headline:** the frontmatter headline role governs shelf headings, reducing to (29px) on tablet and phone.
- **Title:** generous library rows use the title role; continuation cards use (18px), weight (600), line height (1.3), becoming (16px) on small screens.
- **Body:** the base interface role is supplemented by (16px) library authors and (13px) shelf titles.
- **Label:** metadata and actions use the label role; shelf format/progress text is (11px), and navigation uses its separate role.
- **Reader heading:** regular Georgia with chapter spacing. Reading paragraphs use Georgia and line height (1.9), with user-adjustable font size on desktop and responsive mobile overrides.

**The Editorial Hierarchy Rule.** Use bold Georgia for workspace page and section headings; use sans-serif for navigation, controls, book titles, and metadata.

## Layout

The workspace has a centered maximum width of (1700px). Desktop main content uses (35px 56px 60px) padding below a sticky header of (112px); its three columns place the wordmark left, capsule navigation centrally, and circular controls right. At (1100px), content side padding becomes (38px). At (760px), the wordmark disappears and the header becomes two columns. At (540px), main side padding is (23px), the header is (83px) tall, and the import action becomes a circular icon.

Open shelves use auto-filled columns with a minimum of (142px), gaps of (38px 32px), and covers capped at (180px) wide. Explicit responsive grids use five columns below (1100px), four below (760px), and two below (540px). The large library list uses full-width rows with a cover (64px) wide, gap (27px), vertical padding (27px), and a fine bottom separator. Phone list covers become (53px) wide and rows retain a clear title/author/format hierarchy.

Continue cards form three columns with a maximum group width of (1260px). At intermediate widths two are shown. Below (540px), all cards form a horizontal snap scroller with cards (305px) wide and a visible next-card preview. The open shelf remains a two-column grid rather than a horizontal carousel.

The reader occupies the viewport and scrolls its document area independently. Text pages are centered, with default desktop page padding (70px 80px 85px), reducing to (37px 28px 65px) on phone. Floating reader tools remain grouped; secondary tools collapse on smaller screens. Knowledge filters wrap and give document/color selects enough width for their labels.

## Elevation & Depth

Depth is concentrated in floating controls and book covers. Shelves sit directly on the white canvas, library rows use separators, and the reading page has no shadow. Soft shadows indicate controls hovering over the workspace; physical book shadows distinguish the covers without turning every document into a container card.

### Shadow Vocabulary

- **Navigation:** `0 11px 25px #0000000b`, the broad floating capsule.
- **Circular action:** `0 8px 20px #00000008`, quiet header controls.
- **Book cover:** `2px 5px 10px #0002, 0 1px 2px #0002`, small physical depth.
- **Continue cover:** `0 2px 5px #0003`, thumbnail depth inside continuation cards.
- **Dropdown:** `0 16px 50px #0002`, temporary menus above the content.
- **Reader header controls:** `0 9px 24px #00000008`.
- **Annotation toolbar:** `0 10px 30px #0000000d`.

**The Open Shelf Rule.** Place books on the open canvas; reserve raised containers for controls, menus, and continuation cards.

The sticky workspace header uses an (18px) backdrop blur and a mostly opaque background. Common buttons change background over (150ms); continuation cards use a (180ms) background transition; covers lift and rotate over (220ms) using `cubic-bezier(0.16, 1, 0.3, 1)`. The reduced-motion query disables animation/transitions, restores automatic scrolling, and suppresses cover hover movement.

## Shapes

Long rounded capsules and circular buttons define the controls. Navigation uses the navigation radius with slightly tighter active pills; menus use the menu radius, continuation cards and search use the card radius, and filter chips use the chip radius. Ordinary form inputs and secondary buttons retain the smaller field radius.

Book covers preserve their tall (2:3) proportion with subtly asymmetric corners (2px 3px 3px 2px). The reader paper remains rectangular. Dividers are fine, neutral, and structural; they separate library rows and tool groups rather than enclosing whole shelves.

## Components

### Buttons

Primary workspace actions are compact charcoal pills with white labels, an inline outline icon, and the primary-hover background. Secondary buttons use a light surface and inset one-pixel border. Disabled buttons use (0.4) opacity and a disabled cursor. The inherited keyboard focus treatment is a two-pixel accent outline with a four-pixel offset. Phone page actions reduce to an icon while retaining their accessible name.

### Chips

Format filters are quiet rounded text controls with a selected gray fill, darker text, and slightly stronger weight. Small count badges sit inside the chip. Hover uses the secondary surface. Filters may wrap; do not truncate meaningful filter labels to fit a fixed row.

### Cards / Containers

Continuation cards combine a small upright cover, title, author, and progress on the documented dark subdued fills. Their text stays white and progress stays light. Hover brightens the card by a factor of (1.06). Library rows remain open and separated by fine rules. Book cover hover/focus lifts the cover (5px) and rotates it (-1deg), with reduced motion respected.

Sample covers are original typographic SVG compositions authored in `scripts/generate-covers.mjs`, with geometric motifs and a provenance statement embedded in each SVG. They are not publisher editions or generated raster artwork. Imported PDFs receive a first-page preview; EPUBs use their embedded cover where available. Documents without an extracted cover receive the app's generated typographic fallback with author, title, icon, and format. Preserve source covers and their proportions.

### Inputs / Fields

The workspace search is a soft-gray rounded bar with an outline search icon, a flexible borderless input, and an explicit close control. Standard fields use the surface background, one-pixel border, field radius, and (10px 12px) padding. The global focus outline applies to ordinary inputs; the implemented search input explicitly removes its native outline, which needs separate accessibility attention rather than becoming a reusable rule.

### Navigation

The three primary destinations live in one floating top capsule. Each destination uses the navigation type role and generous horizontal padding; the current destination receives selected gray and weight (600). Search sits inside the capsule; secondary navigation appears through circular menus to the right. Mobile preserves the same top navigation in a compact form, reducing label size to (13px) on phone.

### Reader controls

Reader header tools form left/right rounded groups with only the document title centered between them. A single click or tap on the document hides all chrome; another restores it without moving the page. Selection, scrolling, double-click word selection, and drawing must not trigger this toggle. Escape restores keyboard access, and hidden controls are inert.

The brush button opens the annotation palette; it is closed by default. The palette floats (20px) above the desktop viewport bottom, or (14px) on mobile, and temporarily replaces the thumbnail strip. Closing it returns to text selection. All tools remain reachable on mobile by wrapping. A floating page counter uses (18px) desktop and (16px) mobile text. The bottom capsule contains clickable miniature pages: PDFs reuse the loaded PDF.js document and render visible previews lazily; text documents show their actual content at miniature scale. The tiny (2px) preview body and (2.8px) preview heading are non-reading artwork inside an aria-hidden miniature, never a scale for UI labels; each thumbnail button carries an accessible page label. EPUB uses previous/next controls and its true reading percentage. Application labels such as format, save status, sample notices, duplicate running titles, and extra page numbers stay outside the reading page; original PDF content is preserved. Selected tools use a quiet gray fill; the active brush uses black with a white nib; active bookmarks use red.

## Do's and Don'ts

### Shared interface components

Header menus retain the incumbent 330px width, 28px corners, 20px/15px padding, borderless offset shadow, 15px labels with 14px/15px row padding, and centered 25px bold serif collection heading. These values are a dedicated header variant; book menus stay compact. Preserve this distinction when changing Mantine defaults.

Mantine 9 supplies the shared controls in `src/components/ui/controls.tsx`, plus `ActionIcon`, `Modal` and `Menu`. The theme lives in `src/components/ui/provider.tsx`; color scheme comes from the existing account preference, including system mode. CSS layers are ordered `theme, base, mantine, components, utilities` so Tailwind's reset cannot erase Mantine padding or borders. `controls.css` maps the components to the existing neutral palette and serif modal headings. The 14px application root is compensated with Mantine's theme scale.

Use the shared controls for forms and actions. NativeSelect retains platform keyboard and mobile picker behavior. Specialized file, color and range inputs use Mantine's Input primitive while retaining browser gestures. Menus and modals render in portals, support Escape and manage keyboard focus. Keep reader geometry, document content and shelf layout independent of this component library.

The machine-readable sidecar includes `extensions.implementationInventory`: an exact catalog of font sizes, radii and colors retained in the CSS, including legacy selectors. It is an inventory, not permission to reuse legacy styles for new UI. Existing named roles remain authoritative. Coarse-pointer controls have a minimum 44px target; reader annotation palettes can scroll vertically on small screens. The editor adds hand panning, object dragging, underline, a thinner pencil stroke and property updates for the selected object. Knowledge date filters wrap with the other controls. Statistics separate today's goal from accumulated time and list the last seven local calendar dates.

### Do:

- **Do** keep broad white space around shelves and preserve the large editorial heading hierarchy.
- **Do** use the top floating capsule for primary workspace navigation on desktop and phone.
- **Do** let document covers carry color and keep surrounding workspace chrome neutral.
- **Do** retain visible white titles and light progress labels on dark continuation cards.
- **Do** keep library rows spacious and the reader page rectangular, white, and free of shadow by default.
- **Do** preserve keyboard labels, focus visibility, wrapping filters, and reduced-motion behavior.
- **Do** record original cover provenance and use extracted source covers when available.

### Don't:

- **Don't** restore the rejected beige canvas or dominant workspace sidebar.
- **Don't** place every shelf book in a bordered or raised container.
- **Don't** convert workspace page and shelf headings into generic sans-serif dashboard headings.
- **Don't** treat the palette of one book cover as a new interface accent.
- **Don't** shrink the mobile open shelf below its two-column structure or clip filter labels to force a single row.
- **Don't** invent decorative kicker labels or copy the reader's tiny running-title treatment into new interface hierarchy.
