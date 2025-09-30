# Task planning Rules of Thumb
1. The task file should start with a title in the format `# Task Title`.
2. The goal of a task should be preceeded by a checkbox (i.e. [] Create a new paintable canvas)
3. Underneath each task are a numbered list of subtasks. Each line should contain one subtask (i.e. 1. create `<canvas>` element)

# Implementation Rules of Thumb
1. Always use preact/htm when dynamic components are being created using javascript.
2. A preact component should be created using the following rules:
- use `Component` from preact for class-based components
- `this.state` for state management
- `componentDidMount()` and `componentWillUnmount()` for lifecycle methods
- Regular class methods and properties instead of hooks
2. When a reusable utility function is being created to support a new feature, consider moving it to `js/util.js`.
3. Likewise, when a reusable component is being created, consider creating a separate file in the `js/custom-ui` folder to host that component.
