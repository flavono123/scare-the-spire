# QA Issue Taxonomy

## Severity Levels

| Severity | Definition | Examples |
|----------|------------|----------|
| **critical** | Blocks a core workflow, causes data loss, or crashes the app | Form submit causes error page, checkout flow broken, data deleted without confirmation |
| **high** | Major feature broken or unusable, no workaround | Search returns wrong results, file upload silently fails, auth redirect loop |
| **medium** | Feature works but with noticeable problems, workaround exists | Slow page load (>5s), form validation missing but submit still works, layout broken on mobile only |
| **low** | Minor cosmetic or polish issue | Typo in footer, 1px alignment issue, hover state inconsistent |

## Categories

### 1. Visual/UI
- Layout breaks (overlapping elements, clipped text, horizontal scrollbar)
- Broken or missing images
- Incorrect z-index (elements appearing behind others)
- Font/color inconsistencies (especially gc-batang font rendering)
- Animation glitches (jank, incomplete transitions)
- Alignment issues (off-grid, uneven spacing)
- Dark mode / theme issues

### 2. Functional
- Broken links (404, wrong destination)
- Dead buttons (click does nothing)
- Filter/search not working correctly
- Incorrect redirects
- State not persisting (data lost on refresh, back button)
- Version selector malfunction
- Entity detail page routing broken

### 3. UX
- Confusing navigation (no breadcrumbs, dead ends)
- Missing loading indicators
- Slow interactions (>500ms with no feedback)
- Unclear error messages
- Inconsistent interaction patterns across pages
- Dead ends (no way back, no next action)

### 4. Content
- Wrong Korean translations (not matching game i18n)
- Placeholder / lorem ipsum text left in
- Truncated text (cut off without ellipsis)
- Wrong labels on buttons or form fields
- Missing or unhelpful empty states
- Entity name mismatch between list and detail pages

### 5. Performance
- Slow page loads (>3 seconds)
- Layout shifts (content jumping after load)
- Large unoptimized images
- Excessive bundle size
- SSG build errors or warnings

### 6. Console/Errors
- JavaScript exceptions (uncaught errors)
- Failed network requests (4xx, 5xx)
- Next.js hydration mismatches
- Missing image/asset warnings
- Build-time errors

### 7. Accessibility
- Missing alt text on images
- Keyboard navigation broken
- Insufficient color contrast
- Content not reachable by screen reader

## Per-Page Exploration Checklist

For each page visited during a QA session:

1. **Visual scan** — Look for layout issues, broken images, alignment
2. **Interactive elements** — Click every button, link, filter, and control
3. **Navigation** — Check all paths in/out, breadcrumbs, back button, deep links
4. **States** — Check empty state, loading state, error state, overflow state
5. **Console** — Check for JS errors or failed requests after interactions
6. **Content** — Verify Korean text, entity names match game translations
7. **Responsiveness** — Check mobile and tablet viewports if relevant
