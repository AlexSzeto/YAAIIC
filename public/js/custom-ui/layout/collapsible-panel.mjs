/**
 * collapsible-panel.mjs – Controlled expand/collapse panel with a header row.
 *
 * The parent owns the expand state. The panel always renders the header;
 * content animates in/out beneath it via a CSS grid-template-rows transition.
 *
 * @param {preact.VNode} props.header    – Content rendered on the left of the header row
 * @param {preact.VNode} props.content   – Content shown when expanded
 * @param {boolean}      props.expanded  – Whether the panel is currently open
 * @param {Function}     props.onExpand  – Called when the chevron button is clicked
 */
import { html } from 'htm/preact';
import { styled } from '../goober-setup.mjs';
import { currentTheme } from '../theme.mjs';
import { HorizontalEdgesLayout } from '../themed-base.mjs';
import { Button } from '../io/button.mjs';

// Grid wrapper: transitioning grid-template-rows is the cleanest way to
// animate height from 0 to auto without a fixed max-height hack.
const ContentWrapper = styled('div')`
  display: grid;
  transition: grid-template-rows 0.2s ease;
  overflow: hidden;
`;
ContentWrapper.className = 'collapsible-panel-content';

// Inner div must have min-height: 0 for the grid collapse to work correctly.
const ContentInner = styled('div')`
  min-height: 0;
`;
ContentInner.className = 'collapsible-panel-inner';

export function CollapsiblePanel({ header, content, expanded, onExpand }) {
  return html`
    <div>
      <${HorizontalEdgesLayout}>
        <div>${header}</div>
        <${Button}
          variant="small-icon"
          color="transparent"
          icon=${expanded ? 'chevron-down' : 'chevron-right'}
          onClick=${onExpand}
        />
      </${HorizontalEdgesLayout}>
      <${ContentWrapper} style=${{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
        <${ContentInner}>${content}</${ContentInner}>
      </${ContentWrapper}>
    </div>
  `;
}
