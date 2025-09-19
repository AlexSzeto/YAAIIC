// Header Component - Main application title
import { Component } from 'preact';
import { html } from 'htm/preact';

/**
 * HeaderComponent - Renders the main application title
 */
export class HeaderComponent extends Component {
  constructor(props) {
    super(props);
  }
  
  render() {
    const { title = "YAAIIG (Yet Another AI Image Generator)" } = this.props;
    
    return html`
      <h1>${title}</h1>
    `;
  }
}

export default HeaderComponent;