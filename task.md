# Custom UI: Tabs and Floating Panel Components

## Goal

Add two new reusable custom UI components: a `Tabs` component for horizontal tab-based content switching, and a `FloatingPanel` component for a draggable, portal-rendered overlay panel. Both components should follow existing codebase conventions and be documented in `test.html`.

## Tasks

- [ ] Create `public/js/custom-ui/layout/tab-panels.mjs` with the `Tabs` component
- [ ] Style the `Tabs` component: rounded top corners on tab buttons, active tab bottom edge merges into the panel body, panel body has rounded corners matching `Panel` variant styles
- [ ] Implement `Tabs` panel body variant support: `default`, `elevated`, `outlined`, `glass` — matching how `Panel` resolves variant styles via a JS switch into an inline `style` object
- [ ] Implement `Tabs` tab size prop: `tabSize` — `'small-text' | 'medium-text'` passed through to each tab's child `Button` as its `variant` prop (default: `'medium-text'`)
- [ ] Implement `Tabs` active tab highlighting: active tab's `Button` uses `color='primary'`, inactive uses `color='secondary'`, matching `ButtonGroup` selection pattern
- [ ] Create `public/js/custom-ui/overlays/floating-panel.mjs` with the `FloatingPanel` component
- [ ] Implement `FloatingPanel` portal rendering via `createPortal` to `document.body`, following `modal.mjs` pattern
- [ ] Implement `FloatingPanel` `initialPosition` prop: one of `'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'center'` — resolved to `top`/`left` pixel values on mount using `position: fixed`
- [ ] Implement `FloatingPanel` drag behavior: mousedown on drag handle starts drag; mousemove on `document` updates panel position; mouseup releases; position clamped to viewport bounds
- [ ] Implement `FloatingPanel` toolbar strip: drag handle icon at top-left, `actions` buttons in the middle, spacer, optional close button at top-right; all buttons use `variant='medium-icon'`
- [ ] Implement `FloatingPanel` visibility via `isOpen` and `onClose` props, following `modal.mjs` pattern; close button only rendered when `onClose` is provided
- [ ] Implement `FloatingPanel` `variant` styling (`default`, `elevated`, `outlined`, `glass`) using the same theme token resolution as `Panel`, but without a dark overlay backdrop
- [ ] Add `Tabs` usage examples to `public/js/custom-ui/test.html` demonstrating: all panel variants, both tab sizes, and controlled `activeTab` / `onTabChange` usage
- [ ] Add `FloatingPanel` usage examples to `public/js/custom-ui/test.html` demonstrating: all `initialPosition` values, with and without close button, with and without action buttons, and all panel variants

## Implementation Details

### Tabs (`public/js/custom-ui/nav/tabs.mjs`)

**Props:**
```js
Tabs({
  tabs,           // Array<{ id: string, label: string, content: VNode }> - required
  activeTab,      // string - id of the active tab - required (controlled)
  onTabChange,    // (id: string) => void - required (controlled)
  tabSize,        // 'small-text' | 'medium-text' - default: 'medium-text'
  variant,        // 'default' | 'elevated' | 'outlined' | 'glass' - default: 'default'
  ...rest         // forwarded to root element
})
```

**Structure:**
```
<div class="tabs-root" ...rest>
  <div class="tabs-bar">
    [for each tab] <Button variant={tabSize} color={isActive ? 'primary' : 'secondary'} onClick={...}>{label}</Button>
  </div>
  <div class="tabs-panel" style={variantStyle}>
    {activeTabContent}
  </div>
</div>
```

**Styling notes:**
- Each tab button has top-left and top-right border-radius, bottom border-radius = 0 (visually removed for active tab to fuse with panel body)
- Active tab bottom border matches the panel body background so they appear fused
- Panel body uses the same variant->style resolution switch as `Panel` (see `layout/panel.mjs`)
- Use `theme.border.radius`, `theme.colors.background.*`, `theme.shadow.*` tokens

**Patterns to follow:**
- Class component with `currentTheme.subscribe` in `componentDidMount` / `componentWillUnmount`
- All styled components use `StyledX` naming + `.className = 'x'`
- Variant styles resolved via JS `switch` into inline `style` object

---

### FloatingPanel (`public/js/custom-ui/overlays/floating-panel.mjs`)

**Props:**
```js
FloatingPanel({
  isOpen,          // boolean - required
  onClose,         // () => void - optional; if provided, renders close button
  initialPosition, // 'top-left'|'top'|'top-right'|'right'|'bottom-right'|'bottom'|'bottom-left'|'left'|'center' - default: 'center'
  actions,         // Array<{ icon: string, color?: string, onClick: fn }> - optional
  variant,         // 'default' | 'elevated' | 'outlined' | 'glass' - default: 'elevated'
  width,           // string (CSS value) - optional, sizes to content if omitted
  height,          // string (CSS value) - optional, sizes to content if omitted
  children,        // VNode - panel body content
  ...rest          // forwarded to panel container
})
```

**Structure:**
```
Portal(document.body) ->
  <div class="floating-panel" style={position: fixed, top, left, width?, height?, ...variantStyle}>
    <div class="floating-toolbar">
      <Button variant="medium-icon" icon="grip-dots" />  <- mousedown starts drag
      {actions.map(a => <Button variant="medium-icon" icon={a.icon} color={a.color} onClick={a.onClick} />)}
      <div class="toolbar-spacer" />  <- flex: 1
      {onClose && <Button variant="medium-icon" icon="x" onClick={onClose} />}
    </div>
    <div class="floating-body">
      {children}
    </div>
  </div>
```

**Position resolution (on mount):**
- `top-left`     -> `{ top: margin, left: margin }`
- `top`          -> `{ top: margin, left: 50%, transform: translateX(-50%) }`
- `top-right`    -> `{ top: margin, right: margin }`
- `right`        -> `{ top: 50%, right: margin, transform: translateY(-50%) }`
- `bottom-right` -> `{ bottom: margin, right: margin }`
- `bottom`       -> `{ bottom: margin, left: 50%, transform: translateX(-50%) }`
- `bottom-left`  -> `{ bottom: margin, left: margin }`
- `left`         -> `{ top: 50%, left: margin, transform: translateY(-50%) }`
- `center`       -> `{ top: 50%, left: 50%, transform: translate(-50%, -50%) }`
- After first render, resolve actual `top`/`left` pixel values from the DOM and store in state so dragging can offset from a known numeric origin (use a ref on the panel element and call `getBoundingClientRect()` on the underlying DOM node).

**Drag behavior:**
- State: `{ x: number, y: number, isDragging: bool, dragStartX, dragStartY, originX, originY }`
- `mousedown` on drag handle: record `dragStartX/Y` = `e.clientX/Y`, `originX/Y` = current `x/y`, set `isDragging = true`
- `mousemove` on `document`: if dragging, `newX = originX + (e.clientX - dragStartX)`, `newY = originY + (e.clientY - dragStartY)`, clamp to viewport
- `mouseup` on `document`: set `isDragging = false`
- Attach/detach document listeners in `componentDidMount` / `componentWillUnmount`

**Styling notes:**
- No dark backdrop overlay (unlike modals)
- `variant` resolves to style object via same switch pattern as `Panel`
- Drag handle uses `cursor: grab`, `cursor: grabbing` while `isDragging`
- Use `theme.border.radius`, `theme.colors.background.*`, `theme.shadow.*` tokens
- `z-index: 1000` to float above page content

**Patterns to follow:**
- `createPortal` from `preact/compat` targeting `document.body`
- Class component with `currentTheme.subscribe` + drag event listeners in lifecycle methods
- `StyledX` component naming + `.className = 'x'`
- Returns `null` when `!isOpen`
- Per client rules: do NOT attach `ref` to a styled component — attach it to a plain inner `<div>` for DOM measurement
