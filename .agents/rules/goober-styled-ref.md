---
trigger: always_on
---

When attaching a `ref` to a goober `styled()` component in Preact, `ref.current` will be a Preact **component instance**, not a DOM element. Calling `.getBoundingClientRect()` or any DOM method on it will throw `TypeError: ... is not a function`.

**Fix**: Instead of using a `ref` on the styled component, assign it a stable id and resolve the DOM node at call-time via `document.getElementById(id)`:

```js
// ❌ WRONG – ref.current is a Preact instance, not a DOM node
const myRef = useRef(null);
...
<${StyledDiv} ref=${myRef} />
...
myRef.current.getBoundingClientRect(); // TypeError!

// ✅ CORRECT – resolve the real DOM node by id
const idRef = useRef('my-component-' + Math.random().toString(36).slice(2));
...
<${StyledDiv} id=${idRef.current} />
...
const el = document.getElementById(idRef.current);
if (el) el.getBoundingClientRect(); // works correctly
```

The stable id should be created inside a `useRef` (not `useMemo` or plain variable) so it persists across renders without changing. This pattern is already used in hover-panel.mjs as the established convention in this codebase.