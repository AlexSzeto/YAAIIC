/**
 * character-part-item.mjs â€“ Simplified part form for the Character tab.
 *
 * Renders a 128Ã—128 display-only preview image and a flat list of labelled
 * attribute value dropdowns/inputs (one per categoryAttribute and customAttribute
 * from the library config). Preview generation is triggered manually via the
 * DynamicList header action button in the parent component.
 *
 * Props:
 *   @param {Object}   part           â€“ Character part entry: { partUid, categoryAttributeValues, customAttributeValues, previewImageUrl }
 *   @param {Object}   libraryConfig  â€“ Full part config from library: { name, baseline, previewBaseline, categoryAttributes, customAttributes }
 *   @param {Function} onPartChange   â€“ Called with updated part object
 *   @param {boolean}  [isGenerating] â€“ True while a preview generation is in-flight for this part
 */
import { html } from 'htm/preact';
import { useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { getCategoryTree, getTagDefinition } from '../tags/tag-data.mjs';
import { ImagePreview } from './image-preview.mjs';

// ============================================================================
// Option builders for Select dropdowns
// ============================================================================

function getCategoryOptions(categoryInternal) {
  if (!categoryInternal) return [{ label: '(none)', value: '' }];
  const tree = getCategoryTree();
  const children = tree[categoryInternal];
  const options = [{ label: '(none)', value: '' }];
  if (Array.isArray(children)) {
    for (const child of children) {
      options.push({ label: child.replace(/_/g, ' '), value: child });
    }
  } else {
    options.push({ label: categoryInternal.replace(/_/g, ' '), value: categoryInternal });
  }
  return options;
}

function getCustomOptions(optionsString) {
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
 * @param {Object}   props.part            â€“ { partUid, categoryAttributeValues, customAttributeValues, previewImageUrl }
 * @param {Object}   [props.libraryConfig] â€“ Library config for this part (may be undefined if not found)
 * @param {Function} props.onPartChange    â€“ Called with updated part
 * @param {boolean}  [props.isGenerating]  â€“ True while preview generation is in-flight
 */
export function CharacterPartItem({ part, libraryConfig, onPartChange, isGenerating = false }) {
  const categoryAttributes = libraryConfig?.categoryAttributes || [];
  const customAttributes = libraryConfig?.customAttributes || [];

  const handleCategoryAttrChange = useCallback((attrName, value) => {
    onPartChange({
      ...part,
      categoryAttributeValues: { ...part.categoryAttributeValues, [attrName]: value },
    });
  }, [part, onPartChange]);

  const handleCustomAttrChange = useCallback((attrName, value) => {
    onPartChange({
      ...part,
      customAttributeValues: { ...part.customAttributeValues, [attrName]: value },
    });
  }, [part, onPartChange]);

  return html`
    <${VerticalLayout} gap="small">
      <${TopRow}>
        <${ImagePreview}
          src=${part.previewImageUrl}
          alt="Part preview"
          isGenerating=${isGenerating}
        />

        <${AttributesColumn}>
          ${categoryAttributes.map(attr => html`
            <${Select}
              key=${'cat-' + attr.name}
              label=${attr.name}
              value=${part.categoryAttributeValues?.[attr.name] || ''}
              options=${getCategoryOptions(attr.category)}
              onChange=${(e) => handleCategoryAttrChange(attr.name, e.target.value)}
              widthScale="full"
              tooltip=${getTagDefinition(part.categoryAttributeValues?.[attr.name] || '') || null}
            />
          `)}
          ${customAttributes.map(attr => attr.options
            ? html`
              <${Select}
                key=${'cust-' + attr.name}
                label=${attr.name}
                value=${part.customAttributeValues?.[attr.name] || ''}
                options=${getCustomOptions(attr.options)}
                onChange=${(e) => handleCustomAttrChange(attr.name, e.target.value)}
                widthScale="full"
                tooltip=${getTagDefinition(part.customAttributeValues?.[attr.name] || '') || null}
              />`
            : html`
              <${Input}
                key=${'cust-' + attr.name}
                label=${attr.name}
                value=${part.customAttributeValues?.[attr.name] || ''}
                onInput=${(e) => handleCustomAttrChange(attr.name, e.target.value)}
                placeholder=${attr.name}
                widthScale="full"
              />`
          )}
          ${categoryAttributes.length === 0 && customAttributes.length === 0
            ? html`<span style=${{ color: currentTheme.value.colors.text.muted, fontSize: currentTheme.value.typography.fontSize.small }}>No attributes defined</span>`
            : null
          }
        </${AttributesColumn}>
      </${TopRow}>
    </${VerticalLayout}>
  `;
}

