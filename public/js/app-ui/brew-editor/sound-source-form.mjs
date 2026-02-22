/**
 * sound-source-form.mjs – Sub-form for editing a single ambient sound source.
 *
 * Props: { item, onChange }
 * Calls onChange(updatedItem) on every field edit.
 */
import { html } from 'htm/preact';
import { useState, useCallback, useRef } from 'preact/hooks';
import { Input } from '../../custom-ui/io/input.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { RangeSlider } from '../../custom-ui/io/range-slider.mjs';
import { DynamicList } from '../../custom-ui/layout/dynamic-list.mjs';
import { VerticalLayout, HorizontalLayout } from '../../custom-ui/themed-base.mjs';
import { Gallery } from '../main/gallery.mjs';
import { createGalleryPreview } from '../main/gallery-preview.mjs';

/**
 * SoundSourceForm – Fields for a single sound source entry.
 *
 * @param {Object} props
 * @param {Object} props.item - The sound source object
 * @param {Function} props.onChange - Called with updated source object
 */
export function SoundSourceForm({ item, onChange }) {
  // Track which clip index has the gallery open
  const [galleryClipIndex, setGalleryClipIndex] = useState(null);

  const handleLabelChange = useCallback((e) => {
    onChange({ ...item, label: e.target.value });
  }, [item, onChange]);

  const handleClipsChange = useCallback((clips) => {
    onChange({ ...item, clips });
  }, [item, onChange]);

  const handleClipTextChange = useCallback((index, value) => {
    const nextClips = [...(item.clips || [])];
    nextClips[index] = value;
    onChange({ ...item, clips: nextClips });
  }, [item, onChange]);

  const handleGallerySelect = useCallback((entry) => {
    if (galleryClipIndex === null) return;
    const nextClips = [...(item.clips || [])];
    nextClips[galleryClipIndex] = entry.audioUrl || entry.url || '';
    onChange({ ...item, clips: nextClips });
    setGalleryClipIndex(null);
  }, [item, onChange, galleryClipIndex]);

  const renderClipItem = useCallback((clip, index) => {
    return html`
      <${HorizontalLayout} gap="small" style=${{ alignItems: 'center', flex: 1 }}>
        <${Input}
          value=${clip}
          widthScale="full"
          heightScale="compact"
          onInput=${(e) => handleClipTextChange(index, e.target.value)}
          placeholder="Audio path or URL"
        />
        <${Button}
          variant="small-icon-text"
          icon="image"
          onClick=${() => setGalleryClipIndex(index)}
          title="Browse media gallery"
        >
          Browse
        </${Button}>
      </${HorizontalLayout}>
    `;
  }, [handleClipTextChange]);

  const clips = item.clips || [];
  const repeatCount = item.repeatCount || { min: 1, max: 1 };
  const repeatDelay = item.repeatDelay || { min: 0, max: 0 };
  const attack = item.attack || { min: 0, max: 0.5 };
  const decay = item.decay || { min: 0, max: 0.5 };

  return html`
    <${VerticalLayout} gap="medium">
      <${Input}
        label="Label"
        value=${item.label || ''}
        widthScale="full"
        onInput=${handleLabelChange}
        placeholder="Source name"
      />

      <${DynamicList}
        title="Clips"
        items=${clips}
        renderItem=${renderClipItem}
        getTitle=${(clip) => clip || 'Clip'}
        createItem=${() => ''}
        onChange=${handleClipsChange}
        addLabel="Add Clip"
        condensed=${true}
      />

      <${RangeSlider}
        label="Repeat Count"
        minAllowed=${0}
        maxAllowed=${20}
        snap=${1}
        min=${repeatCount.min}
        max=${repeatCount.max}
        width="100%"
        onChange=${({ min, max }) => onChange({ ...item, repeatCount: { min, max } })}
      />

      <${RangeSlider}
        label="Repeat Delay (s)"
        minAllowed=${0}
        maxAllowed=${60}
        snap=${0.1}
        min=${repeatDelay.min}
        max=${repeatDelay.max}
        width="100%"
        onChange=${({ min, max }) => onChange({ ...item, repeatDelay: { min, max } })}
      />

      <${RangeSlider}
        label="Attack (s)"
        minAllowed=${0}
        maxAllowed=${10}
        snap=${0.1}
        min=${attack.min}
        max=${attack.max}
        width="100%"
        onChange=${({ min, max }) => onChange({ ...item, attack: { min, max } })}
      />

      <${RangeSlider}
        label="Decay (s)"
        minAllowed=${0}
        maxAllowed=${10}
        snap=${0.1}
        min=${decay.min}
        max=${decay.max}
        width="100%"
        onChange=${({ min, max }) => onChange({ ...item, decay: { min, max } })}
      />

      <${Gallery}
        isOpen=${galleryClipIndex !== null}
        onClose=${() => setGalleryClipIndex(null)}
        queryPath="/media-data"
        previewFactory=${createGalleryPreview}
        selectionMode=${true}
        fileTypeFilter=${['audio']}
        onSelect=${handleGallerySelect}
      />
    </${VerticalLayout}>
  `;
}
