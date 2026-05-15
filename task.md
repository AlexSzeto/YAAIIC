# Untitled
## Goal
## Tasks

## Implementation Details

According to the **autoComplete.js** documentation, there is **no direct configuration option** (such as a `wrapper.class` property) to assign a custom CSS class to the wrapper upon initialization.

The library's `wrapper` configuration option is strictly a **boolean**:

* **`true` (Default):** Automatically wraps the input field in a `<div>` tag with the fixed class name **`.autoComplete_wrapper`**.
* **`false`:** Completely disables the automatic wrapping behavior.

If you need to apply a custom CSS class globally to the wrapper container, you can easily achieve this using one of the three standard implementations below:

### Method 1: Disable the Built-in Wrapper and Provide Your Own (Recommended)

If you want total semantic control over the layout and classes of your container, set `wrapper: false` in your configuration, and structure your HTML with your custom global classes manually.

**HTML:**

```html
<div class="my-global-custom-wrapper another-utility-class">
  <input id="autoComplete" type="search" dir="ltr" spellcheck="false" autocorrect="off" autocomplete="off">
</div>

```

**JavaScript:**

```javascript
const autoCompleteJS = new autoComplete({
  selector: "#autoComplete",
  wrapper: false, // Disables the automatic .autoComplete_wrapper injection
  // ... rest of your configuration
});

```

### Method 2: Programmatically Inject the Class via JavaScript

If you prefer to let the library automatically generate the wrapper but still need a specific class hooked into it, you can target the container immediately after initializing the component using standard DOM tree traversal:

```javascript
const autoCompleteJS = new autoComplete({
  selector: "#autoComplete",
  wrapper: true, // Keep the default wrapper generation
  // ... rest of your configuration
});

// Find the generated parent wrapper and append your global class
const wrapper = document.querySelector("#autoComplete").closest(".autoComplete_wrapper");
if (wrapper) {
  wrapper.classList.add("my-global-custom-modal-class");
}

```

### Method 3: Direct CSS Target Overriding

Because the component uniformly applies `.autoComplete_wrapper` to its automatically generated element globally, you don't necessarily have to change the HTML markup. You can just override or extend that native class name directly inside your main stylesheet:

```css
/* Apply global styles directly to the default built-in wrapper class */
.autoComplete_wrapper {
  position: relative;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

```

---

### Summary of Class Customization Capabilities

| Element | Custom Class via Config Object? | Example Implementation Syntax |
| --- | --- | --- |
| **Input Field** | Yes (Handled via HTML markup) | Managed directly on the element matching `selector` |
| **Wrapper Container** | **No** (Boolean toggle only) | Controlled explicitly by `wrapper: true/false` |
| **Results List (`<ul>`)** | **Yes** | `resultsList: { class: "custom-list-class" }` |
| **Result Item (`<li>`)** | **Yes** | `resultItem: { class: "custom-item-class" }` |