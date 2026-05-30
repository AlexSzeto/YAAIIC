import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { useToast } from '../custom-ui/msg/toast.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { H1, VerticalLayout } from '../custom-ui/themed-base.mjs';
import { Panel } from '../custom-ui/layout/panel.mjs';
import { AppHeader } from './themed-base.mjs';
import { HamburgerMenu } from './hamburger-menu.mjs';

export function ConfigApp() {
  const toast = useToast();
  const [purging, setPurging]                   = useState(false);
  const [purgingPortraits, setPurgingPortraits] = useState(false);

  async function handlePurge() {
    setPurging(true);
    try {
      const res = await fetch('/admin/storage/purge', { method: 'POST' });
      const { moved } = await res.json();
      toast.success(`Purge complete — ${moved} file${moved !== 1 ? 's' : ''} moved to quarantine`);
    } catch {
      toast.error('Purge failed');
    } finally {
      setPurging(false);
    }
  }

  async function handlePurgePortraits() {
    setPurgingPortraits(true);
    try {
      const res = await fetch('/admin/storage/purge-portraits', { method: 'POST' });
      const { moved } = await res.json();
      toast.success(`Portrait purge complete — ${moved} file${moved !== 1 ? 's' : ''} moved to quarantine`);
    } catch {
      toast.error('Portrait purge failed');
    } finally {
      setPurgingPortraits(false);
    }
  }

  return html`
    <${VerticalLayout}>
      <${AppHeader}>
        <${H1}>Configuration</${H1}>
        <${HamburgerMenu} />
      </${AppHeader}>
      <${Panel} padding="large">
        <${VerticalLayout} gap="small">
          <${Button}
            variant="medium-icon-text"
            icon="trash"
            color="danger"
            disabled=${purging}
            onClick=${handlePurge}
          >Purge Unreferenced Files</${Button}>
          <${Button}
            variant="medium-icon-text"
            icon="image-alt"
            color="danger"
            disabled=${purgingPortraits}
            onClick=${handlePurgePortraits}
          >Purge Portrait Cache</${Button}>
        </${VerticalLayout}>
      </${Panel}>
    </${VerticalLayout}>
  `;
}
