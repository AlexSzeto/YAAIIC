import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../custom-ui/goober-setup.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';
import { Modal } from '../custom-ui/overlays/modal.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { Icon } from '../custom-ui/layout/icon.mjs';
import { DynamicList } from '../custom-ui/layout/dynamic-list.mjs';
import { showDialog } from '../custom-ui/overlays/dialog.mjs';
import { useQueueStatus } from './use-queue-status.mjs';

const SOURCE_LABELS = {
  'yaaiic': 'YAAIIC',
  'yaaiic-inpaint': 'YAAIIC Inpaint',
  'anytale': 'AnyTale',
};

const TYPE_ICONS = {
  image: 'image',
  video: 'video',
  audio: 'microphone',
  text: 'file-detail',
};

const ACTIVE_STATES = new Set(['running', 'cancelling', 'skipping', 'pausing']);

const ItemRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  color: ${() => currentTheme.value.colors.text.primary};
  overflow: hidden;
`;
ItemRow.className = 'queue-dashboard-item-row';

const SourceLabel = styled('span')`
  color: ${() => currentTheme.value.colors.text.secondary};
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  flex-shrink: 0;
`;
SourceLabel.className = 'queue-dashboard-source-label';

const ItemName = styled('span')`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
ItemName.className = 'queue-dashboard-item-name';

const RunningBadge = styled('span')`
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  color: ${() => currentTheme.value.colors.text.secondary};
  flex-shrink: 0;
  opacity: 0.7;
`;
RunningBadge.className = 'queue-dashboard-running-badge';

const EmptyMessage = styled('p')`
  text-align: center;
  padding: 24px 0;
  opacity: 0.6;
  font-family: ${() => currentTheme.value.typography.fontFamily};
  color: ${() => currentTheme.value.colors.text.secondary};
`;
EmptyMessage.className = 'queue-dashboard-empty';

/**
 * QueueDashboardModal — shows live queue state with reorder, delete, start/pause, and clear.
 *
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 */
export function QueueDashboardModal({ isOpen, onClose }) {
  const { state, items } = useQueueStatus();
  const activeItems = items.filter(i => i.status !== 'failed');
  const isActive = ACTIVE_STATES.has(state);

  // Single onChange handles both delete (shorter array) and reorder (same length).
  const handleChange = useCallback(async (newItems) => {
    if (newItems.length < activeItems.length) {
      const newIds = new Set(newItems.map(i => i.id));
      const removed = activeItems.find(i => !newIds.has(i.id));
      if (removed) {
        await fetch(`/queue/item/${removed.id}`, { method: 'DELETE' });
      }
    } else {
      for (let i = 0; i < newItems.length; i++) {
        if (newItems[i].id !== activeItems[i].id) {
          await fetch('/queue/reorder', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: newItems[i].id, toIndex: i }),
          });
          break;
        }
      }
    }
  }, [activeItems]);

  const handleStart = useCallback(() => fetch('/queue/start', { method: 'POST' }), []);
  const handlePause = useCallback(() => fetch('/queue/pause', { method: 'POST' }), []);

  const handleClear = useCallback(async () => {
    const result = await showDialog('Clear all queued tasks?', 'Clear Queue', ['Clear', 'Cancel']);
    if (result !== 'Clear') return;
    await fetch('/queue/clear', { method: 'POST' });
  }, []);

  const stateLabel = state ? state.charAt(0).toUpperCase() + state.slice(1) : '';

  // Pin index 0 when queue is actively running a task.
  const canDrop = isActive ? (from, to) => from !== 0 && to !== 0 : undefined;

  const footer = html`
    ${(state === 'running' || state === 'cancelling' || state === 'skipping' || state === 'pausing')
      ? html`<${Button} variant="medium-text" icon="pause" onClick=${handlePause}>Pause</${Button}>`
      : html`<${Button} variant="medium-text" color="primary" icon="play" onClick=${handleStart} disabled=${activeItems.length === 0}>Start</${Button}>`
    }
    <${Button} variant="medium-text" color="danger" onClick=${handleClear} disabled=${activeItems.length === 0}>Clear</${Button}>
    <${Button} variant="medium-text" onClick=${onClose}>Close</${Button}>
  `;

  return html`
    <${Modal}
      isOpen=${isOpen}
      onClose=${onClose}
      title=${'Task Queue (' + stateLabel + ')'}
      size="medium"
      footer=${footer}
    >
      ${activeItems.length === 0
        ? html`<${EmptyMessage}>Queue is empty</${EmptyMessage}>`
        : html`
          <${DynamicList}
            items=${activeItems}
            renderItem=${(item) => html`
              <${ItemRow}>
                <${Icon} name=${TYPE_ICONS[item.type] || 'image'} size='24px' color=${currentTheme.value.colors.text.secondary} />
                <${SourceLabel}>${TYPE_ICONS[item.type]} ${item.type} ${SOURCE_LABELS[item.source] || item.source}</${SourceLabel}>
                <span style=${{ color: currentTheme.value.colors.text.secondary }}>–</span>
                <${ItemName}>${item.name}${item.subLabel ? ` (${item.subLabel})` : ''}</${ItemName}>
                <${RunningBadge}>${item.status}</${RunningBadge}>
              </${ItemRow}>
            `}
            createItem=${() => null}
            onChange=${handleChange}
            hideAddItem=${true}
            condensed=${true}
            showDragButton=${true}
            canDrop=${canDrop}
          />
        `
      }
    </${Modal}>
  `;
}
