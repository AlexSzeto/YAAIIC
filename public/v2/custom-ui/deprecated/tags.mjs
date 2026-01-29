import { html, Component } from 'htm/preact';
import { Button } from './button.mjs';

/**
 * Tags Component
 * Displays a row of selectable tag buttons
 * 
 * @param {Object} props
 * @param {Array<{id: string, name: string}>} props.items - The selectable tag buttons
 * @param {Array<string>} props.selected - Array of currently selected item ids
 * @param {Function} props.onSelect - Callback when a tag is clicked (receives id)
 */
export class Tags extends Component {
  render() {
    const { items = [], selected = [], onSelect, ...props } = this.props;

    return html`
      <div class="tags-container" ...${props}>
        ${items.map(item => {
          const isSelected = selected.includes(item.id);
          const variant = isSelected ? 'primary-small-text' : 'small-text';
          
          return html`
            <${Button}
              key=${item.id}
              variant=${variant}
              onClick=${() => onSelect && onSelect(item.id)}
              title=${item.name}
            >
              ${item.name}
            <//>
          `;
        })}
      </div>
    `;
  }
}
