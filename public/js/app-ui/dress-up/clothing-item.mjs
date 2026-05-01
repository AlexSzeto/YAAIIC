/**
 * clothing-item.mjs – Single clothing-item row for the Dress-Up form.
 *
 * Fields: Name, Worn, Layer, Body Part, State, Attributes, Related Tags, Delete.
 */
import { html } from 'htm/preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Select } from '../../custom-ui/io/select.mjs';
import { Checkbox } from '../../custom-ui/io/checkbox.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { TagInput } from '../../custom-ui/io/tag-input.mjs';
import { HorizontalLayout, VerticalLayout } from '../../custom-ui/themed-base.mjs';
import { Icon } from '../../custom-ui/layout/icon.mjs';
import { getTags } from '../tags/tags.mjs';

const STATE_KEYWORDS = ['lift', 'pull', 'unworn', 'removing'];

const LAYER_OPTIONS = [
  { label: 'Inner', value: 'inner' },
  { label: 'Outer', value: 'outer' }
];

const BODY_PART_OPTIONS = [
  { label: 'Head', value: 'head' },
  { label: 'Upper Body', value: 'upper body' },
  { label: 'Lower Body', value: 'lower body' },
  { label: 'Legs', value: 'legs' }
];

// Styled components
const ItemCard = styled('div')`
  padding: ${() => currentTheme.value.spacing.medium.padding};
  border: ${() => currentTheme.value.border.width} ${() => currentTheme.value.border.style} ${() => currentTheme.value.colors.border.primary};
  border-radius: ${() => currentTheme.value.spacing.medium.borderRadius};
  background-color: ${() => currentTheme.value.colors.background.secondary};
  opacity: ${props => props.dimmed ? '0.5' : '1'};
  transition: opacity ${() => currentTheme.value.transitions.fast};
`;
ItemCard.className = 'clothing-item-card';

const TopRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${() => currentTheme.value.spacing.small.gap};
  flex-wrap: wrap;
`;
TopRow.className = 'top-row';

const FieldRow = styled('div')`
  display: flex;
  gap: ${() => currentTheme.value.spacing.small.gap};
  align-items: end;
  flex-wrap: wrap;
  margin-top: ${() => currentTheme.value.spacing.small.margin};
`;
FieldRow.className = 'field-row';

const PillContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
`;
PillContainer.className = 'pill-container';

const Pill = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: ${() => currentTheme.value.typography.fontSize.small};
  background-color: ${() => currentTheme.value.colors.primary.background};
  color: ${() => currentTheme.value.colors.primary.text};
  cursor: default;
`;
Pill.className = 'attribute-pill';

const PillRemove = styled('button')`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  color: ${() => currentTheme.value.colors.primary.text};
  opacity: 0.7;
  &:hover { opacity: 1; }
`;
PillRemove.className = 'pill-remove';

const AttributeSearch = styled('div')`
  position: relative;
  flex: 1;
  min-width: 150px;
`;
AttributeSearch.className = 'attribute-search';

const SuggestionList = styled('ul')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: ${() => currentTheme.value.colors.background.secondary};
  border: ${() => currentTheme.value.border.width} ${() => currentTheme.value.border.style} ${() => currentTheme.value.colors.border.primary};
  border-radius: ${() => currentTheme.value.spacing.small.borderRadius};
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  padding: 0;
  margin: 4px 0 0 0;
`;
SuggestionList.className = 'suggestion-list';

const SuggestionItem = styled('li')`
  padding: ${() => currentTheme.value.spacing.small.padding};
  cursor: pointer;
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  &:hover {
    background-color: ${() => currentTheme.value.colors.background.hover};
  }
`;
SuggestionItem.className = 'suggestion-item';

/**
 * @param {Object}   props
 * @param {Object}   props.item       – clothing item data
 * @param {Function} props.onChange    – (updatedItem) => void
 * @param {Function} props.onDelete   – (id) => void
 */
export function ClothingItem({ item, onChange, onDelete }) {
  const [attrQuery, setAttrQuery] = useState('');
  const [attrSuggestions, setAttrSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Build state options from tag data based on item name
  const stateOptions = useMemo(() => {
    if (!item.name) return [{ label: '(none)', value: '' }];
    const allTags = getTags();
    const matches = [{ label: '(none)', value: '' }];
    for (const keyword of STATE_KEYWORDS) {
      const search = `${item.name} ${keyword}`.toLowerCase();
      for (const tag of allTags) {
        if (tag.toLowerCase() === search) {
          matches.push({ label: tag, value: tag });
        }
      }
    }
    return matches;
  }, [item.name]);

  // Build tag set used for state (to exclude from attribute suggestions)
  const stateTags = useMemo(() => {
    const set = new Set();
    for (const opt of stateOptions) {
      if (opt.value) set.add(opt.value.toLowerCase());
    }
    return set;
  }, [stateOptions]);

  // Attribute autocomplete search
  useEffect(() => {
    if (!attrQuery.trim()) {
      setAttrSuggestions([]);
      return;
    }
    const allTags = getTags();
    const q = attrQuery.trim().toLowerCase();
    const existing = new Set(item.attributes.map(a => a.toLowerCase()));
    const results = allTags
      .filter(tag => {
        const lower = tag.toLowerCase();
        return lower.includes(q) && !existing.has(lower) && !stateTags.has(lower);
      })
      .slice(0, 20);
    setAttrSuggestions(results);
  }, [attrQuery, item.attributes, stateTags]);

  const update = useCallback((patch) => {
    onChange({ ...item, ...patch });
  }, [item, onChange]);

  const addAttribute = useCallback((tag) => {
    if (!item.attributes.includes(tag)) {
      update({ attributes: [...item.attributes, tag] });
    }
    setAttrQuery('');
    setShowSuggestions(false);
  }, [item, update]);

  const removeAttribute = useCallback((tag) => {
    update({ attributes: item.attributes.filter(a => a !== tag) });
  }, [item, update]);

  return html`
    <${ItemCard} dimmed=${!item.worn}>
      <${VerticalLayout} gap="small">
        <${TopRow}>
          <${Checkbox}
            label="Worn"
            checked=${item.worn}
            onChange=${(e) => update({ worn: e.target.checked })}
          />
          <div style=${{ flex: 1 }}>
            <${Input}
              label="Name"
              value=${item.name}
              onInput=${(e) => update({ name: e.target.value })}
              placeholder="e.g. shirt, skirt, bra"
              widthScale="full"
            />
          </div>
          <${Button}
            variant="small-icon"
            icon="trash"
            color="danger"
            onClick=${() => onDelete(item.id)}
            title="Delete item"
          />
        </${TopRow}>

        <${FieldRow}>
          <${Select}
            label="Layer"
            options=${LAYER_OPTIONS}
            value=${item.layer}
            onChange=${(e) => update({ layer: e.target.value })}
          />
          <${Select}
            label="Body Part"
            options=${BODY_PART_OPTIONS}
            value=${item.bodyPart}
            onChange=${(e) => update({ bodyPart: e.target.value })}
          />
          <${Select}
            label="State"
            options=${stateOptions}
            value=${item.state}
            onChange=${(e) => update({ state: e.target.value })}
          />
        </${FieldRow}>

        <${AttributeSearch}>
          <${Input}
            label="Attributes"
            value=${attrQuery}
            onInput=${(e) => { setAttrQuery(e.target.value); setShowSuggestions(true); }}
            onFocus=${() => setShowSuggestions(true)}
            onBlur=${() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search tags to add..."
            widthScale="full"
          />
          ${showSuggestions && attrSuggestions.length > 0 ? html`
            <${SuggestionList}>
              ${attrSuggestions.map(tag => html`
                <${SuggestionItem}
                  key=${tag}
                  onMouseDown=${(e) => { e.preventDefault(); addAttribute(tag); }}
                >${tag}</${SuggestionItem}>
              `)}
            </${SuggestionList}>
          ` : null}
        </${AttributeSearch}>

        ${item.attributes.length > 0 ? html`
          <${PillContainer}>
            ${item.attributes.map(attr => html`
              <${Pill} key=${attr}>
                ${attr}
                <${PillRemove} onClick=${() => removeAttribute(attr)} title="Remove">
                  <${Icon} name="x" size="12px" color="currentColor" />
                </${PillRemove}>
              </${Pill}>
            `)}
          </${PillContainer}>
        ` : null}

        <${TagInput}
          label="Related Tags"
          value=${item.relatedTags}
          onInput=${(v) => update({ relatedTags: v })}
          rows=${2}
          placeholder="Additional related tags..."
        />
      </${VerticalLayout}>
    </${ItemCard}>
  `;
}
