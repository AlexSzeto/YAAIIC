import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { Panel } from '../custom-ui/layout/panel.mjs';
import { useQueueStatus } from './use-queue-status.mjs';
import { QueueDashboardModal } from './queue-dashboard.mjs';

const BannerWrapper = styled('div')`
  position: fixed;
  bottom: ${props => props.progressVisible ? 'calc(1rem + 104px)' : '1rem'};
  right: 1rem;
  z-index: 4900;
  transition: bottom 0.2s ease;
`;
BannerWrapper.className = 'queue-status-banner';

const BannerContent = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.large.gap};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.secondary};
  white-space: nowrap;
`;
BannerContent.className = 'queue-status-banner-content';

/**
 * QueueStatusBanner — fixed bottom-right chip showing queue state and item count.
 * Opens QueueDashboardModal when the arrow button is clicked.
 * Only visible when the queue has at least one active (non-failed) item.
 *
 * @param {boolean} [props.progressVisible=false] - When true, offsets above the ProgressBanner.
 */
export function QueueStatusBanner({ progressVisible = false }) {
  const { state, items } = useQueueStatus();
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const activeItems = items.filter(i => i.status !== 'failed');

  useEffect(() => {
    if (activeItems.length === 0) setDashboardOpen(false);
  }, [activeItems.length]);

  if (activeItems.length === 0) return null;

  const stateLabel = state ? state.charAt(0).toUpperCase() + state.slice(1) : '';
  const label = `${stateLabel} (${activeItems.length} Queued)`;

  return html`
    <${BannerWrapper} progressVisible=${progressVisible}>
      <${Panel} variant="elevated" color="secondary" padding="medium">
        <${BannerContent}>
          <span>${label}</span>
          <${Button}
            variant="small-icon"
            icon="arrow-out-up-right-square"
            tooltip="Open Task Queue"
            onClick=${() => setDashboardOpen(true)}
          />
        </${BannerContent}>
      </${Panel}>
    </${BannerWrapper}>

    <${QueueDashboardModal}
      isOpen=${dashboardOpen}
      onClose=${() => setDashboardOpen(false)}
    />
  `;
}
