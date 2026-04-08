# Fix Dynamic List Drag/Drop using Native HTML5 

## Tasks
[] Remove state based ghost object repositioning and try to use the native HTML5 example as provided, which has smooth drag/drop motion, but preserve the rendering of the ghost object within the list and the look and feel of the current drag ghost DOM element.

## Implementation Details
The following example is able to create smooth drag/drop action:
```javascript
import "./style";
import { Component, render } from "preact";
import "preact/debug";
import cls from "obj-str";
import { Menu } from "preact-feather";

const items = [
  {
    id: 0
  },
  {
    id: 1
  },
  {
    id: 2
  },
  {
    id: 3
  },
  {
    id: 4
  },
  {
    id: 5
  },
  {
    id: 6
  }
];

class DnD extends Component {
  state = {
    dragging: false,
    draggable: -1,
    dragged: -1,
    over: -1
  };

  onMouseDown(idx) {
    this.setState({
      draggable: idx
    });
  }

  onMouseUp() {
    this.setState({
      draggable: -1
    });
  }

  dragStart(idx, e) {
    if (e.target.getAttribute("draggable") === "false") return;

    e.dataTransfer.setData("application/json", JSON.stringify(this.item));
    e.dataTransfer.effectAllowed = "move";

    this.setState({
      dragging: true,
      dragged: idx,
      over: idx
    });
  }
  dragEnd(idx, e) {
    this.setState({
      dragging: false,
      draggable: -1,
      dragged: -1,
      over: -1
    });
  }
  dragOver(idx, e) {
    this.setState({
      over: idx
    });

    if (idx === this.state.dragged) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
  }
  drop(target, e) {
    const { dragged } = this.state;

    if (dragged === target) return;

    const newItems = this.props.items.slice();

    newItems.splice(target, 0, newItems.splice(dragged, 1)[0]);

    this.props.onSort(newItems);
  }

  render(
    { container: Container, item: Item, items, handle: Handle, prop, onSort },
    { dragged, dragging, over, draggable }
  ) {
    let newItems = dragging && over !== dragged ? items.slice() : items;

    if (dragging && over !== dragged) {
      newItems.splice(over, 0, newItems.splice(dragged, 1)[0]);
    }

    return (
      <div class="row">
        <div class="col-lg-6">
          <Container aria-dropeffect="move">
            {newItems.map((data, idx) => (
              <Item
                key={data[prop]}
                data={data}
                handle={
                  <Handle
                    onMouseDown={this.onMouseDown.bind(this, idx)}
                    onMouseUp={this.onMouseUp.bind(this)}
                  />
                }
                draggable={!Handle || draggable === idx}
                over={dragging && idx === over}
                onDragStart={this.dragStart.bind(this, idx)}
                onDragEnd={this.dragEnd.bind(this, idx)}
                onDragOver={this.dragOver.bind(this, idx)}
                onDrop={this.drop.bind(this, idx)}
                role="option"
                aria-grabbed={dragging && idx === over}
              />
            ))}
          </Container>
        </div>
        <div class="col-lg-6">
          <Container aria-dropeffect="move">
            {newItems.map((data, idx) => (
              <Item
                key={data[prop]}
                data={data}
                handle={
                  <Handle
                    onMouseDown={this.onMouseDown.bind(this, idx)}
                    onMouseUp={this.onMouseUp.bind(this)}
                  />
                }
                draggable={!Handle || draggable === idx}
                over={dragging && idx === over}
                onDragStart={this.dragStart.bind(this, idx)}
                onDragEnd={this.dragEnd.bind(this, idx)}
                onDragOver={this.dragOver.bind(this, idx)}
                onDrop={this.drop.bind(this, idx)}
                role="option"
                aria-grabbed={dragging && idx === over}
              />
            ))}
          </Container>
        </div>
      </div>
    );
  }
}

DnD.defaultProps = {
  container: ({ children, ...props }) => <ul {...props}>{children}</ul>,
  item: ({ data }) => <li>{JSON.stringify(data)}</li>,
  onSort: () => {},
  onSwap: (from, to) => {},
  prop: "id"
};

const Item = ({ data, handle, dragged, over, ...props }) => {
  return (
    <li class={cls({ item: true, dragged, over })} {...props}>
      {handle}
      <section class="content">
        <p>Item #{data.id}</p>
      </section>
    </li>
  );
};

export default class App extends Component {
  state = {
    items
  };

  render({}, { items }) {
    return (
      <main>
        <h1>Example</h1>
        <DnD
          container={({ children }) => <ul class="list">{children}</ul>}
          item={Item}
          handle={({ ...props }) => (
            <button class="handle" {...props}>
              <Menu />
            </button>
          )}
          items={items}
          onSort={newItems => {
            this.setState({ items: newItems });
          }}
        />
      </main>
    );
  }
}

if (typeof window !== "undefined") {
  render(<App />, document.getElementById("root"));
}

```