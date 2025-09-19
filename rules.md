# Implementation Rules of Thumb
1. Always use preact/htm when dynamic components are being created using javascript.
2. When a reusable utility function is being created to support a new feature, consider moving it to `js/util.js`.
3. Likewise, when a reusable component is being created, consider creating a separate file in the `js/custom-ui` folder to host that component.
