import { html } from 'htm/preact';
import { Component, createRef } from 'preact';
import { createPortal } from 'preact/compat';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { Button } from '../io/button.mjs';
import { Icon } from '../layout/icon.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const StyledFloatingPanel = styled('div')`
  display: flex;
  flex-direction: column;
  transition: background-color 0.2s ease, 
              border-color 0.2s ease,
              box-shadow 0.2s ease;
`;
StyledFloatingPanel.className = 'styled-floating-panel';

const StyledToolbar = styled('div')`
  display: flex;
  align-items: center;
  gap: ${props => props.gap};
  padding: ${props => props.padding};
  border-bottom: 1px solid ${props => props.borderColor};
  background-color: ${props => props.bgColor};
  border-top-left-radius: ${props => props.borderRadius};
  border-top-right-radius: ${props => props.borderRadius};
  user-select: none;
`;
StyledToolbar.className = 'styled-toolbar';

const StyledDragHandle = styled('div')`
  cursor: ${props => props.cursor};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;
StyledDragHandle.className = 'styled-drag-handle';

const ToolbarSpacer = styled('div')`
  flex: 1;
`;
ToolbarSpacer.className = 'toolbar-spacer';

const StyledBody = styled('div')`
  flex: 1;
  overflow: auto;
  padding: ${props => props.padding};
`;
StyledBody.className = 'styled-body';

/**
 * FloatingPanel - Draggable, portal-rendered overlay panel
 * 
 * A floating panel that renders via portal to document.body, supports dragging,
 * and can be positioned anywhere on the screen. Includes an optional toolbar
 * with action buttons and close button.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the panel is visible (required)
 * @param {Function} [props.onClose] - Callback when close button is clicked; if provided, renders close button
 * @param {'top-left'|'top'|'top-right'|'right'|'bottom-right'|'bottom'|'bottom-left'|'left'|'center'} [props.initialPosition='center'] - Starting position
 * @param {Array<{icon: string, color?: string, onClick: Function}>} [props.actions=[]] - Action buttons for toolbar
 *   - icon: Icon name for the button
 *   - color: Optional color theme ('primary', 'secondary', 'success', 'danger')
 *   - onClick: Click handler for the action
 * @param {'default'|'elevated'|'outlined'|'glass'} [props.variant='elevated'] - Panel style variant
 * @param {string} [props.width] - CSS width value (optional, sizes to content if omitted)
 * @param {string} [props.height] - CSS height value (optional, sizes to content if omitted)
 * @param {preact.ComponentChildren} props.children - Panel body content
 * @returns {preact.VNode|null}
 * 
 * @example
 * // Basic floating panel
 * <FloatingPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   initialPosition="top-right"
 * >
 *   <p>Panel content</p>
 * </FloatingPanel>
 * 
 * @example
 * // Panel with action buttons
 * <FloatingPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   variant="elevated"
 *   actions={[
 *     { icon: 'refresh', color: 'primary', onClick: handleRefresh },
 *     { icon: 'save', color: 'success', onClick: handleSave }
 *   ]}
 * >
 *   <p>Content with actions</p>
 * </FloatingPanel>
 */
export class FloatingPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      theme: currentTheme.value,
      x: 0,
      y: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      originX: 0,
      originY: 0,
      isPositioned: false
    };
    this.panelRef = createRef();
  }

  componentDidMount() {
    this.unsubscribe = currentTheme.subscribe((theme) => {
      this.setState({ theme });
    });

    // Attach document-level drag event listeners
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Calculate initial position after mount
    this.calculateInitialPosition();
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  componentDidUpdate(prevProps) {
    // Recalculate position if isOpen changes from false to true
    if (!prevProps.isOpen && this.props.isOpen) {
      this.calculateInitialPosition();
    }
  }

  calculateInitialPosition = () => {
    // Wait for next frame to ensure DOM is rendered
    requestAnimationFrame(() => {
      if (!this.panelRef.current) return;

      const { initialPosition = 'center' } = this.props;
      const margin = 20; // pixels from edge
      const panel = this.panelRef.current;
      const rect = panel.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = 0;
      let y = 0;

      switch (initialPosition) {
        case 'top-left':
          x = margin;
          y = margin;
          break;
        case 'top':
          x = (viewportWidth - width) / 2;
          y = margin;
          break;
        case 'top-right':
          x = viewportWidth - width - margin;
          y = margin;
          break;
        case 'right':
          x = viewportWidth - width - margin;
          y = (viewportHeight - height) / 2;
          break;
        case 'bottom-right':
          x = viewportWidth - width - margin;
          y = viewportHeight - height - margin;
          break;
        case 'bottom':
          x = (viewportWidth - width) / 2;
          y = viewportHeight - height - margin;
          break;
        case 'bottom-left':
          x = margin;
          y = viewportHeight - height - margin;
          break;
        case 'left':
          x = margin;
          y = (viewportHeight - height) / 2;
          break;
        case 'center':
        default:
          x = (viewportWidth - width) / 2;
          y = (viewportHeight - height) / 2;
          break;
      }

      this.setState({ x, y, isPositioned: true, originX: x, originY: y });
    });
  };

  handleMouseDown = (e) => {
    e.preventDefault();
    const { x, y } = this.state;
    this.setState({
      isDragging: true,
      dragStartX: e.clientX,
      dragStartY: e.clientY,
      originX: x,
      originY: y
    });
  };

  handleMouseMove = (e) => {
    if (!this.state.isDragging) return;

    const { dragStartX, dragStartY, originX, originY } = this.state;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    let newX = originX + deltaX;
    let newY = originY + deltaY;

    // Clamp to viewport bounds
    if (this.panelRef.current) {
      const rect = this.panelRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    this.setState({ x: newX, y: newY });
  };

  handleMouseUp = () => {
    if (this.state.isDragging) {
      this.setState({ isDragging: false });
    }
  };

  render() {
    const { 
      isOpen,
      onClose,
      initialPosition = 'center',
      actions = [],
      variant = 'elevated',
      width,
      height,
      children,
      style: propStyle,
      ...rest
    } = this.props;
    const { theme, x, y, isDragging, isPositioned } = this.state;

    if (!isOpen) return null;

    // Build panel body styles based on variant
    const baseStyle = {
      borderRadius: theme.spacing.medium.borderRadius,
      display: 'flex',
      flexDirection: 'column',
    };

    let variantStyle = {};
    
    switch (variant) {
      case 'default':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
        };
        break;
      case 'elevated':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: 'none',
          boxShadow: theme.shadow.elevated,
        };
        break;
      case 'outlined':
        variantStyle = {
          backgroundColor: theme.colors.background.card,
          border: `2px ${theme.border.style} ${theme.colors.border.secondary}`,
        };
        break;
      case 'glass':
        variantStyle = {
          backgroundColor: theme.colors.overlay.glass,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: 'none',
        };
        break;
    }

    const combinedStyle = { 
      ...baseStyle, 
      ...variantStyle, 
      ...propStyle 
    };

    const panelContent = html`
      <div 
        ref=${this.panelRef}
        style=${{ 
          position: 'fixed',
          top: `${y}px`,
          left: `${x}px`,
          zIndex: 1000,
          width: width || 'auto',
          height: height || 'auto',
          visibility: isPositioned ? 'visible' : 'hidden'
        }}
      >
        <${StyledFloatingPanel} style=${combinedStyle} ...${rest}>
          <${StyledToolbar}
            gap=${theme.spacing.small.gap}
            padding=${theme.spacing.small.padding}
            borderColor=${theme.colors.border.secondary}
            bgColor=${theme.colors.background.card}
            borderRadius=${theme.spacing.medium.borderRadius}
          >
            <${StyledDragHandle}
              cursor=${isDragging ? 'grabbing' : 'grab'}
              onMouseDown=${this.handleMouseDown}
            >
              <${Icon} name="drag-handle" size="20px" color=${theme.colors.text.secondary} />
            </${StyledDragHandle}>
            
            ${actions.map((action, index) => html`
              <${Button}
                key=${index}
                variant="medium-icon"
                icon=${action.icon}
                color=${action.color || 'secondary'}
                onClick=${action.onClick}
              />
            `)}
            
            <${ToolbarSpacer} />
            
            ${onClose && html`
              <${Button}
                variant="medium-icon"
                icon="x"
                color="secondary"
                onClick=${onClose}
              />
            `}
          </${StyledToolbar}>
          
          <${StyledBody} padding=${theme.spacing.medium.padding}>
            ${children}
          </${StyledBody}>
        </${StyledFloatingPanel}>
      </div>
    `;

    return createPortal(panelContent, document.body);
  }
}
