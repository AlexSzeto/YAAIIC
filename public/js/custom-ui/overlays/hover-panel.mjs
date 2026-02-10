/**
 * hover-panel.mjs - Hover panel component for showing content on hover/programmatically
 * 
 * This module provides a context-based hover panel system that can be used to display
 * floating content panels. The panel can be triggered programmatically or attached to
 * elements for hover-based display.
 * 
 * The panel follows the mouse cursor by positioning itself above and to the right of
 * the cursor position. Use onMouseMove with follow() to enable cursor tracking.
 */

import { html } from 'htm/preact';
import { createContext } from 'preact';
import { useContext, useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';

// ============================================================================
// Styled Components
// ============================================================================

/**
 * Styled panel container with glass effect
 */
const HoverPanelContainer = styled('div')`
  z-index: 10001;
  max-width: 350px;
  max-height: 300px;
  overflow: auto;
  opacity: ${props => props.visible ? 1 : 0};
  transform: translateY(${props => props.visible ? '0' : '-4px'});
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: ${props => props.visible ? 'auto' : 'none'};
`;

// ============================================================================
// Context
// ============================================================================

export const HoverPanelContext = createContext(null);

// ============================================================================
// Internal Panel Component
// ============================================================================

/**
 * Internal HoverPanel component rendered by the Provider
 */
function HoverPanelInternal({ 
  content, 
  visible, 
  position, 
  onMouseEnter, 
  onMouseMove,
  onMouseLeave
}) {
  const [theme, setTheme] = useState(currentTheme.value);
  
  useEffect(() => {
    const unsubscribe = currentTheme.subscribe(setTheme);
    return () => unsubscribe();
  }, []);

  const style = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    padding: theme.spacing.medium.padding,
    borderRadius: theme.spacing.medium.borderRadius,
    backgroundColor: theme.colors.overlay.glass,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: theme.shadow.elevated,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.fontSize.medium,
    lineHeight: '1.5',
  };

  return html`
    <${HoverPanelContainer}
      id="custom-ui-hover-panel"
      visible=${visible}
      style=${style}
      onMouseEnter=${onMouseEnter}
      onMouseMove=${onMouseMove}
      onMouseLeave=${onMouseLeave}
    >
      ${content}
    <//>
  `;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * HoverPanelProvider - Context provider for hover panel functionality
 * 
 * Wrap your application with this provider to enable hover panel functionality.
 * Use the useHoverPanel hook to access show/hide methods.
 * 
 * @param {Object} props
 * @param {preact.ComponentChildren} props.children - App content wrapped by provider
 * @returns {preact.VNode}
 * 
 * @example
 * html`
 *   <${HoverPanelProvider}>
 *     <${MyApp} />
 *   <//>
 * `
 */
export function HoverPanelProvider({ children }) {
  const [state, setState] = useState({
    content: null,
    visible: false,
    position: { x: 0, y: 0 }
  });
  
  const hideTimeoutRef = useRef(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });

  /**
   * Calculate and apply position with panel positioned above and to the right of cursor
   * Uses requestAnimationFrame to ensure panel dimensions are available before positioning
   */
  const calculatePosition = useCallback((mouseX, mouseY) => {
    requestAnimationFrame(() => {
      const panel = document.getElementById('custom-ui-hover-panel');
      if (panel) {
        const dim = panel.getBoundingClientRect();
        console.log(currentTheme.value.spacing.small.padding);
        panel.style.top = `calc(${mouseY - dim.height}px - ${currentTheme.value.spacing.small.padding})`;
        panel.style.left = `calc(${mouseX}px + ${currentTheme.value.spacing.small.padding})`;
      }
    });
    
    return { x: 0, y: 0 };
  }, []);



  /**
   * Show the hover panel with content at mouse cursor position
   * 
   * @param {string|preact.VNode} content - Content to display in the panel
   * @param {MouseEvent|Object} mouseEventOrCoords - Mouse event or {x, y} coordinates
   */
  const show = useCallback((content, mouseEventOrCoords) => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // Extract mouse coordinates
    let mouseX, mouseY;
    if (mouseEventOrCoords && typeof mouseEventOrCoords === 'object') {
      if ('clientX' in mouseEventOrCoords && 'clientY' in mouseEventOrCoords) {
        // It's a mouse event
        mouseX = mouseEventOrCoords.clientX;
        mouseY = mouseEventOrCoords.clientY;
      } else if ('x' in mouseEventOrCoords && 'y' in mouseEventOrCoords) {
        // It's a coordinates object
        mouseX = mouseEventOrCoords.x;
        mouseY = mouseEventOrCoords.y;
      }
    }
    
    // Validate coordinates
    if (mouseX === undefined || mouseY === undefined) {
      throw new Error('HoverPanel: No valid mouse coordinates provided');
    }
    
    // Store mouse position
    mousePositionRef.current = { x: mouseX, y: mouseY };
    
    // Calculate and apply position
    const position = calculatePosition(mouseX, mouseY);
    
    setState({
      content,
      visible: true,
      position
    });
  }, [calculatePosition]);

  /**
   * Hide the hover panel
   * 
   * @param {boolean} immediate - If true, hide immediately without delay
   */
  const hide = useCallback((immediate = false) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    if (immediate) {
      setState(prev => ({ ...prev, visible: false }));
    } else {
      // Small delay to allow mouse to move to panel
      hideTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, visible: false }));
        hideTimeoutRef.current = null;
      }, 150);
    }
  }, []);

  /**
   * Cancel pending hide (e.g., when mouse enters panel)
   */
  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  /**
   * Update panel position to follow cursor movement
   * Call this from onMouseMove handlers to enable cursor tracking
   * 
   * @param {MouseEvent} e - Mouse event with clientX and clientY coordinates
   */
  const follow = useCallback((e) => {
    const { x, y } = calculatePosition(e.clientX, e.clientY);
    setState(prev => ({ ...prev, position: { x, y } }));
  }, [calculatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const value = {
    show,
    hide,
    follow,
    isVisible: state.visible
  };

  return html`
    <${HoverPanelContext.Provider} value=${value}>
      ${children}
      ${createPortal(html`
        <${HoverPanelInternal}
          id="custom-ui-hover-panel"
          content=${state.content}
          visible=${state.visible}
          position=${state.position}
          onMouseEnter=${cancelHide}
          onMouseMove=${follow}
          onMouseLeave=${() => hide()}
        />
      `, document.body)}
    <//>
  `;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access hover panel functionality
 * 
 * @returns {Object} Hover panel methods
 * @returns {Function} return.show - Show hover panel: show(content, mouseEvent)
 * @returns {Function} return.hide - Hide hover panel: hide(immediate?)
 * @returns {Function} return.follow - Update panel position to follow cursor: follow(mouseEvent)
 * @returns {boolean} return.isVisible - Whether the panel is currently visible
 * 
 * @example
 * function MyComponent() {
 *   const hoverPanel = useHoverPanel();
 *   
 *   const handleMouseEnter = (e) => {
 *     hoverPanel.show('Tooltip content here', e);
 *   };
 *   
 *   const handleMouseMove = (e) => {
 *     hoverPanel.follow(e);
 *   };
 *   
 *   const handleMouseLeave = () => {
 *     hoverPanel.hide();
 *   };
 *   
 *   return html`
 *     <button 
 *       onMouseEnter=${handleMouseEnter}
 *       onMouseMove=${handleMouseMove}
 *       onMouseLeave=${handleMouseLeave}
 *     >
 *       Hover me
 *     </button>
 *   `;
 * }
 */
export function useHoverPanel() {
  const context = useContext(HoverPanelContext);
  if (!context) {
    throw new Error('useHoverPanel must be used within a HoverPanelProvider');
  }
  return context;
}
