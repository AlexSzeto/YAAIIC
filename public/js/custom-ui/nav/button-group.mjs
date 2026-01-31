import { html } from 'htm/preact';
import { Component } from 'preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const Container = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${props => props.gap};
`;
Container.className = 'container';

/**
 * ButtonGroup - Container for a row of selectable button items
 * 
 * Displays a horizontal group of buttons that can be used for tag selection,
 * filter toggles, or any multi-select button interface. Wraps when space is limited.
 * 
 * @param {Object} props
 * @param {Array<{id: string, name: string}>} props.items - The selectable button items
 *   - id: Unique identifier for the item
 *   - name: Display text for the button
 * @param {Array<string>} [props.selected=[]] - Array of currently selected item ids
 * @param {Function} [props.onSelect] - Callback when a button is clicked, receives (id: string)
 * @param {'small-text'|'medium-text'} [props.variant='small-text'] - Button size variant
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic tag selection
 * <ButtonGroup 
 *   items={[{ id: 'a', name: 'Option A' }, { id: 'b', name: 'Option B' }]}
 *   selected={['a']}
 *   onSelect={(id) => toggleSelection(id)}
 * />
 * 
 * @example
 * // Medium sized buttons
 * <ButtonGroup 
 *   items={items}
 *   selected={selected}
 *   onSelect={handleSelect}
 *   variant="medium-text"
 * />
 */
export class ButtonGroup extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value
    };
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  render() {
    const { 
      items = [], 
      selected = [], 
      onSelect, 
      variant = 'small-text',
      ...rest 
    } = this.props;
    const { theme } = this.state;

    return html`
      <${Container} gap=${theme.spacing.small.gap} ...${rest}>
        ${items.map(item => {
          const isSelected = selected.includes(item.id);
          
          return html`
            <${Button}
              key=${item.id}
              variant=${variant}
              color=${isSelected ? 'primary' : 'secondary'}
              onClick=${() => onSelect && onSelect(item.id)}
              title=${item.name}
            >
              ${item.name}
            <//>
          `;
        })}
      <//>
    `;
  }
}

// Re-export as Tags for backward compatibility
export { ButtonGroup as Tags };
