/**
 * icon.mjs - Theme-aware Icon component
 * 
 * This component provides a unified icon interface that can render either box-icons
 * or Material Symbols based on the current theme configuration.
 * 
 * Material Symbols documentation: https://developers.google.com/fonts/docs/material_symbols
 * 
 * @module custom-ui/layout/icon
 */

import { html } from 'htm/preact';
import { Component } from 'preact';
import { currentTheme } from '../theme.mjs';

/**
 * Icon name mapping from box-icon names to Material Symbol names
 * 
 * This mapping ensures consistent icon representation across different icon systems.
 * Material Symbols use snake_case names, while box-icons use kebab-case.
 */
const ICON_MAP = {

  /*
  Unverified: AI generated mappings may be incorrect
  */

  // Navigation and controls
  'check': 'check',
  'chevron-down': 'keyboard_arrow_down',
  'chevron-up': 'keyboard_arrow_up',
  'chevron-left': 'keyboard_arrow_left',
  'chevron-right': 'keyboard_arrow_right',
  'menu': 'menu',
  'swap-vertical': 'swap_vert',
  'apps': 'apps',
  'caret-down': 'arrow_drop_down',
  'caret-up': 'arrow_drop_up',
  'caret-left': 'arrow_left',
  'caret-right': 'arrow_right',
  
  // Actions
  'trash-alt': 'delete',
  'edit': 'edit_square',
  'edit-alt': 'edit_note',
  'copy': 'content_copy',
  'save': 'save',
  'download': 'download',
  'arrow-out-up-square-half': 'upload',
  'refresh': 'refresh',
  'sync': 'sync',
  'circle': 'circle',
  'lock': 'lock',
  'lock-open': 'lock_open',
  'eye': 'visibility',
  'eye-slash': 'visibility_off',
  'undo': 'undo',
  'redo': 'redo',
  'recycle': 'cycle',
  'send-alt': 'send',
  
  // Media
  'images': 'image',
  'image-add': 'add_photo_alternate',
  'image-alt': 'image',
  'video': 'videocam',
  'music': 'music_note',
  'ear': 'music_note',
  'ear-slash': 'music_off',
  'volume': 'volume_up',
  'volume-mute': 'volume_off',
  'microphone': 'mic',
  'microphone-slash': 'mic_off',
  'disc': 'album',
  'headphone': 'headphones',
  'book': 'book_2',
  'file-detail': 'docs',
  'message-detail': 'chat',
  'captions': 'subtitles',
  'equalizer': 'graphic_eq',
  
  // Communications
  'search': 'search',
  'search-alt': 'search',
  'filter': 'filter_alt',
  'message': 'message',
  'mail': 'mail',
  'notification': 'notifications',
  'comic-bubble': 'comic_bubble',
  
  // Status and feedback
  'loader': 'progress_activity',
  'loader-alt': 'progress_activity',
  'error': 'error',
  'error-circle': 'error',
  'info-circle': 'info',
  'check-circle': 'check_circle',
  'x-circle': 'cancel',
  'warning': 'warning',
  'help-circle': 'help',
  'radio-circle-marked': 'radio_button_checked',
  'radio-circle': 'radio_button_unchecked',
  'block': 'block',
  
  // Files and folders
  'folder-open': 'folder_open',
  'folder-plus': 'create_new_folder',
  'file': 'description',
  'file-blank': 'insert_drive_file',
  'arrow-out-up-right-square': 'open_in_new',
  'arrow-in-down-square-half': 'download',
  
  // Settings and configuration
  'cog': 'settings',
  'slider': 'tune',
  'adjust': 'adjust',
  'palette': 'palette',
  
  // Layout and organization
  'grid': 'grid_view',
  'grid-alt': 'view_module',
  'list-ul': 'list',
  'dots-vertical': 'more_vert',
  'dots-horizontal': 'more_horiz',
  
  // User and people
  'user': 'person',
  'user-circle': 'account_circle',
  'group': 'group',
  't-shirt': 'apparel',
  'user': 'person',
  'location': 'location_on',
  'map': 'map',

  
  // Miscellaneous
  'home': 'home',
  'brush': 'brush',
  'image': 'image',
  'plus': 'add',
  'minus': 'remove',
  'sun': 'sunny',
  'moon': 'bedtime',
  'cog': 'settings',
  'star': 'star',
  'heart': 'favorite',
  'link': 'link',
  'lock': 'lock',
  'unlock': 'lock_open',
  'lock-open-alt': 'lock_open_right',
  'calendar': 'calendar_today',
  'time': 'schedule',
  'flag': 'flag',
  'tag': 'label',
  'tags': 'local_offer',
  'dice-5': 'casino',
  'dice-3': 'ifl',

  /*
  Verified: These mappings have been manually checked and confirmed to be accurate
  */

  // Unsorted
  'sun': 'sunny',
  'moon': 'bedtime',
  'export': 'publish',
  'chevrons-right': 'last_page',
  'chevrons-left': 'first_page',
  'pencil': 'edit',
  'up-arrow-circle': 'arrow_circle_up',
  'revision': 'refresh',
  'volume-full': 'volume_up',
  'skip-previous': 'skip_previous',
  'skip-next': 'skip_next',
  'x': 'close',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
  'play': 'play_arrow',
  'pause': 'pause',
  'stop': 'stop',
  'trash': 'delete',
  'folder': 'folder',
  'redo': 'redo',
  'broken-arrow-up': 'arrow_warm_up',
  'up-arrow': 'arrow_upward',
  'down-arrow': 'arrow_downward',
  'arrow-right-stroke': 'arrow_right_alt',
  'arrow-left-stroke': 'arrow_left_alt',
  'cut': 'content_cut',
  'crop': 'crop',
  'repeat': 'repeat',
  'drag-handle': 'drag_indicator',
  'expand-right': 'expand_content',
  'collapse-right': 'collapse_content',

};

/**
 * Icon Component
 * 
 * Renders icons using either box-icons or Material Symbols based on theme configuration.
 * Automatically handles size, color, and animation properties.
 * 
 * @param {Object} props - Component properties
 * @param {string} props.name - Icon name (box-icon format, will be mapped to Material Symbol if needed)
 * @param {string} [props.size='24px'] - Icon size (CSS size value)
 * @param {string} [props.color] - Icon color (CSS color value)
 * @param {string} [props.animation] - Animation type ('spin' for box-icons)
 * @param {string} [props.type] - Box-icon type ('solid', 'regular', 'logo')
 * @param {Object} [props.style] - Additional inline styles
 * @param {Object} [props.rest] - Additional props passed to the icon element
 * @returns {preact.VNode}
 * 
 * @example
 * // Basic icon
 * <Icon name="check" size="24px" color="#ffffff" />
 * 
 * @example
 * // Loading spinner
 * <Icon name="loader-alt" animation="spin" size="20px" />
 * 
 * @example
 * // Icon with custom styling
 * <Icon name="trash" size="16px" color="red" style={{ marginRight: '8px' }} />
 */
export class Icon extends Component {
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
      name,
      size = '24px',
      color,
      animation,
      type,
      style = {},
      ...rest
    } = this.props;
    const { theme } = this.state;

    // Determine icon system from theme
    const iconSystem = theme.iconSystem || 'boxicons';

    if (iconSystem === 'material-symbols') {
      // Use Material Symbols
      // Only render if the name is explicitly mapped; otherwise show an invisible
      // placeholder of the correct dimensions to avoid rendering raw text.
      const materialName = ICON_MAP[name];

      if (!materialName) {
        return html`<span
          style=${{ display: 'inline-block', width: size, height: size, flexShrink: '0' }}
        />`;
      }

      // Build class list for Material Symbols
      const classes = ['material-symbols-outlined'];
      
      // Handle animation (convert 'spin' to rotation animation)
      let animationStyle = {};
      if (animation === 'spin') {
        classes.push('icon-spin');
        animationStyle = {
          animation: 'icon-spin 1s linear infinite'
        };
      }

      // Combine styles
      const combinedStyle = {
        fontSize: size,
        color: color,
        ...animationStyle,
        ...style
      };

      return html`<span 
        class=${classes.join(' ')} 
        style=${combinedStyle}
        ...${rest}
      >${materialName}</span>`;
    } else {
      // Use box-icons (default)
      return html`<box-icon 
        name=${name}
        size=${size}
        color=${color}
        animation=${animation}
        type=${type}
        style=${style}
        ...${rest}
      ></box-icon>`;
    }
  }
}
