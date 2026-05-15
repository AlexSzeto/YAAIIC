/**
 * character-part-item.mjs - Simplified part form for the Character tab.
 *
 * Renders a 128x128 display-only preview image and a flat list of labelled
 * attribute value dropdowns (one per attribute from the library config).
 * Preview generation is triggered manually via the DynamicList header action
 * button in the parent component.
 *
 * Props:
 *   @param {Object}   part           - Character part entry: { partUid, attributeValues, previewImageUrl }
 *   @param {Object}   libraryConfig  - Full part config from library: { name, baseline, previewBaseline, attributes }
 *   @param {Function} onPartChange   - Called with updated part object
 *   @param {boolean}  [isGenerating] - True while a preview generation is in-flight for this part
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { getTagDefinition } from '../tags/tag-data.mjs';
import { ImagePreview } from './image-preview.mjs';

// ============================================================================
// Option builders for Select dropdowns
// ============================================================================

function getAttributeOptions(optionsString) {
  const options = [{ label: '(none)', value: '' }];
  if (!optionsString || !optionsString.trim()) return options;
  for (const tag of optionsString.split(',').map(t => t.trim()).filter(t => t)) {
    options.push({ label: tag, value: tag });
  }
  return options;
}

// ============================================================================
// Styled Components
// ============================================================================

const TopRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.medium.gap};
  align-items: flex-start;
`;
TopRow.className = 'char-part-top-row';

const AttributesColumn = styled('div')`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${() => currentTheme.value.spacing.small.gap};
`;
AttributesColumn.className = 'char-part-attributes-column';

// ============================================================================
// Component
// ============================================================================

/**
 * CharacterPartItem
 *
 * @param {Object}   props
 * @param {Object}   props.part            - { partUid, attributeValues, previewImageUrl }
 * @param {Object}   [props.libraryConfig] - Library config for this part (may be undefined if not found)
 * @param {Function} props.onPartChange    - Called with updated part
 * @param {boolean}  [props.isGenerating]  - True while preview generation is in-flight
 */
export function CharacterPartItem({ part, libraryConfig, onPartChange, isGenerating = false, onPreviewGenerate }) {
  const attributes = libraryConfig?.attributes || [];

  // Resolve attribute value from unified map.
  const getAttrValue = (attrName) => part.attributeValues?.[attrName] || '';

  const handleAttrChange = useCallback((attrName, value) => {
    onPartChange({
      ...part,
      attributeValues: { ...(part.attributeValues || {}), [attrName]: value },
    });
  }, [part, onPartChange]);

  return html`
    <${VerticalLayout} gap="small">
      <${TopRow}>
        <div style=${{ display: 'flex', flexDirection: 'column', gap: currentTheme.value.spacing.small.gap, flexShrink: 0 }}>
          <${ImagePreview}
            src=${part.previewImageUrl}
            alt="Part preview"
            isGenerating=${isGenerating}
          />
          ${onPreviewGenerate ? html`
            <${Button}
              variant="small-text"
              color="primary"
              icon="play"
              onClick=${onPreviewGenerate}
              disabled=${isGenerating}
            >
              ${isGenerating ? 'Generating...' : 'Preview'}
            </${Button}>
          ` : null}
        </div>

        <${AttributesColumn}>
          ${attributes.map(attr => html`
            <${Select}
              key=${'attr-' + attr.name}
              label=${attr.name}
              value=${getAttrValue(attr.name)}
              options=${getAttributeOptions(attr.options)}
              onChange=${(e) => handleAttrChange(attr.name, e.target.value)}
              widthScale="full"
              tooltip=${getTagDefinition(getAttrValue(attr.name)) || null}
            />
          `)}
          ${attributes.length === 0
            ? html`<span style=${{ color: currentTheme.value.colors.text.muted, fontSize: currentTheme.value.typography.fontSize.small }}>No attributes defined</span>`
            : null
          }
        </${AttributesColumn}>
      </${TopRow}>
    </${VerticalLayout}>
  `;
}
