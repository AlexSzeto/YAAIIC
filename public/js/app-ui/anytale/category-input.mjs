/**
 * category-input.mjs – Single-value autocomplete input for tag/category selection.
 *
 * Unlike TagInput (which handles comma-separated tags in a textarea), this
 * component is a simple text input that shows autocomplete suggestions from
 * getMergedAutocompleteData(). Selecting a suggestion stores its `internal`
 * name as the value.
 *
 * @module app-ui/anytale/category-input
 */
import { html } from 'htm/preact';
import { useEffect, useRef, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme } from '../../custom-ui/theme.mjs';
import { getMergedAutocompleteData, isTagDefinitionsLoaded } from '../tags/tag-data.mjs';
import { loadTags } from '../tags/tags.mjs';
import { injectAutocompleteStyles } from '../autocomplete-styles.mjs';

let instanceCounter = 0;

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;
FormGroup.className = 'category-input-form-group';

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
`;
Label.className = 'category-input-label';

const StyledInput = styled('input')`
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  border: ${() => currentTheme.value.border.width} ${() => currentTheme.value.border.style} ${() => currentTheme.value.colors.border.primary};
  background-color: ${() => currentTheme.value.colors.background.tertiary};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  transition: ${() => currentTheme.value.transitions.fast};

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${() => currentTheme.value.colors.primary.focus};
  }
`;
StyledInput.className = 'category-input-styled';

/**
 * CategoryInput – Single-value autocomplete for tag/category selection.
 *
 * @param {Object}   props
 * @param {string}   [props.label]       – Label text
 * @param {string}   [props.value]       – The internal tag/category name
 * @param {Function} [props.onSelect]    – (internalName: string) => void
 * @param {string}   [props.placeholder] – Placeholder text
 */
export function CategoryInput({
  label,
  value = '',
  onSelect,
  placeholder = 'Type to search...',
}) {
  const idRef = useRef(`category-input-${++instanceCounter}`);
  const uniqueId = idRef.current;
  const acRef = useRef(null);
  const styleIndexRef = useRef(instanceCounter + 1000); // offset to avoid collision with TagInput

  useEffect(() => {
    const idx = styleIndexRef.current;
    const input = document.getElementById(uniqueId);
    if (!input) return;

    let cancelled = false;

    loadTags().then(() => {
      if (cancelled) return;
      if (!isTagDefinitionsLoaded()) return;

      const data = getMergedAutocompleteData();
      if (!data || data.length === 0) return;

      const listId = `autoComplete_list_${idx}`;
      injectAutocompleteStyles(idx);

      // Tab key handler
      const handleKeydown = (event) => {
        if (event.key === 'Tab' && acRef.current && acRef.current.isOpen) {
          event.preventDefault();
          if (acRef.current.cursor < 0) acRef.current.goTo(0);
        }
      };
      input.addEventListener('keydown', handleKeydown);

      try {
        acRef.current = new autoComplete({
          selector: `#${uniqueId}`,
          placeHolder: placeholder,
          data: {
            src: data.map(d => d.display),
            cache: true,
          },
          resultsList: {
            id: listId,
            tabSelect: true,
            maxResults: 30,
            destination: () => document.body,
            position: 'afterbegin',
          },
          resultItem: { highlight: true },
          events: {
            input: {
              keydown: (event) => {
                if (acRef.current && !acRef.current.isOpen) return;
                switch (event.keyCode) {
                  case 40: case 38:
                    event.preventDefault();
                    event.keyCode === 40 ? acRef.current.next() : acRef.current.previous();
                    break;
                  case 13:
                    event.preventDefault();
                    if (acRef.current.isOpen && acRef.current.cursor < 0) acRef.current.goTo(0);
                    if (acRef.current.cursor >= 0) acRef.current.select();
                    break;
                  case 9:
                    if (acRef.current.resultsList.tabSelect && acRef.current.cursor >= 0) acRef.current.select();
                    break;
                  case 27:
                    acRef.current.close();
                    break;
                }
              },
              open: () => {
                const list = acRef.current.list;
                const rect = input.getBoundingClientRect();
                list.style.position = 'fixed';
                list.style.left = rect.left + 'px';
                list.style.top = (rect.bottom + 2) + 'px';
                list.style.zIndex = '20000';
                list.style.width = rect.width + 'px';
              },
              selection: (event) => {
                const selectedDisplay = event.detail.selection.value;
                // Find the matching data entry to get the internal name
                const match = data.find(d => d.display === selectedDisplay);
                if (match && onSelect) {
                  input.value = match.display;
                  onSelect(match.internal);
                }
              },
            },
          },
        });
      } catch (err) {
        console.error(`[CategoryInput:${uniqueId}] autoComplete construction failed:`, err);
      }

      // Store cleanup ref
      input._categoryCleanup = () => {
        input.removeEventListener('keydown', handleKeydown);
      };
    });

    return () => {
      cancelled = true;
      const el = document.getElementById(uniqueId);
      if (el && el._categoryCleanup) {
        el._categoryCleanup();
        delete el._categoryCleanup;
      }
      if (acRef.current) {
        acRef.current.unInit();
        acRef.current = null;
      }
    };
  }, []);

  // Convert internal value to display value for the input
  const handleInput = useCallback((e) => {
    // When user types manually (not via selection), just update with raw text
    if (onSelect) onSelect(e.target.value);
  }, [onSelect]);

  // Compute display value from internal value
  const displayValue = value
    ? value.replace(/^tag_group:/, '').replace(/_/g, ' ')
    : '';

  return html`
    <${FormGroup}>
      ${label ? html`<${Label} for=${uniqueId}>${label}</${Label}>` : null}
      <${StyledInput}
        id=${uniqueId}
        type="text"
        value=${displayValue}
        onInput=${handleInput}
        placeholder=${placeholder}
      />
    </${FormGroup}>
  `;
}
