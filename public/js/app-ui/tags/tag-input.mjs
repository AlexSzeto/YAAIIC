/**
 * tag-input.mjs – Autocomplete tag-input component (app-ui).
 *
 * Wraps the autoComplete.js library so multiple instances can coexist on the
 * same page.  Each instance gets its own style sheet (scoped by a unique
 * index) and a scoped selector so DOM IDs never collide.
 *
 * @module app-ui/tags/tag-input
 */
import { html } from 'htm/preact';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { currentTheme, getThemeValue } from '../../custom-ui/theme.mjs';
import { getTags, loadTags } from './tags.mjs';
import { injectAutocompleteStyles } from '../autocomplete-styles.mjs';
import '../textarea-caret-position-wrapper.mjs';
import { TagSelectorPanel } from './tag-selector-panel.mjs';
import { suppressContextMenu } from '../../custom-ui/util.mjs';
import { extractWordAtCursor, insertTagAtCursorPos, replaceTagInPrompt } from './tag-insertion-util.mjs';
import { isTagDefinitionsLoaded } from './tag-data.mjs';

// Global counter to guarantee unique IDs across all TagInput instances
let instanceCounter = 0;

const FormGroup = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
`;
FormGroup.className = 'tag-input-form-group';

const Label = styled('label')`
  margin-bottom: 5px;
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
`;
Label.className = 'tag-input-label';

const StyledTextarea = styled('textarea')`
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  resize: vertical;
  min-height: 60px;
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

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;
StyledTextarea.className = 'tag-input-textarea';

// Helper: find current tag boundaries at cursor position
function getCurrentTagBounds(textarea) {
  const cursorPos = textarea.selectionStart;
  const text = textarea.value;
  let startPos = 0;
  let endPos = text.length;

  for (let i = cursorPos - 1; i >= 0; i--) {
    if (text[i] === ',' || text[i] === '\n') {
      startPos = i + 1;
      break;
    }
  }
  for (let i = cursorPos; i < text.length; i++) {
    if (text[i] === ',' || text[i] === '\n') {
      endPos = i;
      break;
    }
  }
  return [startPos, endPos];
}

/**
 * TagInput – Tag autocomplete textarea.
 *
 * @param {Object}  props
 * @param {string}  [props.label]        – Label text above the textarea
 * @param {string}  [props.value]        – Controlled value
 * @param {Function} [props.onInput]     – Called with every input event (value)
 * @param {string}  [props.placeholder]  – Placeholder text
 * @param {number}  [props.rows=3]       – Visible rows
 * @param {boolean} [props.disabled=false]
 * @param {string}  [props.id]           – Optional DOM id override
 */
export function TagInput({
  label,
  value,
  onInput,
  placeholder = 'Type to search for tags...',
  rows = 3,
  disabled = false,
  id: propsId,
  ...rest
}) {
  // Stable unique id for this instance
  const idRef = useRef(propsId || `tag-input-${++instanceCounter}`);
  const uniqueId = idRef.current;

  // We need a ref to the raw <textarea> DOM node. Because we render via a
  // goober styled component we cannot attach a ref directly; instead we look
  // it up by ID after mount.
  const textareaRef = useRef(null);
  const acRef = useRef(null); // autoComplete instance

  // Keep track of injected style index — captured once at construction so it
  // matches the ID we will pass to resultsList.id.
  const styleIndexRef = useRef(instanceCounter);

  // State for right-click tag-selector modal
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [initialSearchTerm, setInitialSearchTerm] = useState('');
  const savedCursorPosRef = useRef(null);

  // Cleanup refs — populated by the async init; accessed by the sync cleanup
  const cleanupContextMenuRef = useRef(null);
  const handleKeydownRef = useRef(null);

  // Initialise autoComplete.js once the <textarea> is in the DOM
  useEffect(() => {
    const idx = styleIndexRef.current;
    console.log(`[TagInput:${uniqueId}] useEffect mount — styleIndex=${idx}`);

    const textarea = document.getElementById(uniqueId);
    if (!textarea) {
      console.warn(`[TagInput:${uniqueId}] textarea element not found in DOM`);
      return;
    }
    textareaRef.current = textarea;
    console.log(`[TagInput:${uniqueId}] textarea found:`, textarea);

    let cancelled = false;

    loadTags().then(loadedTags => {
      if (cancelled) {
        console.log(`[TagInput:${uniqueId}] component unmounted before tags loaded — skipping init`);
        return;
      }
      const tags = loadedTags.length > 0 ? loadedTags : getTags();
      console.log(`[TagInput:${uniqueId}] tags loaded: ${tags.length}`);
      if (tags.length === 0) {
        console.warn(`[TagInput:${uniqueId}] no tags available — autocomplete not initialised`);
        return;
      }
      initAutoComplete(textarea, tags, idx);
    }).catch(err => {
      console.error(`[TagInput:${uniqueId}] loadTags() failed:`, err);
    });

    // Extracted so it can run after the async tag load
    const initAutoComplete = (textarea, tags, idx) => {
      // The CSS selectors in injectAutocompleteStyles target #autoComplete_list_${idx}.
      // We must pass the same ID to resultsList.id so the library names its DOM
      // element to match — otherwise the autoComplete.js internal instance counter
      // diverges from ours and styles never apply.
      const listId = `autoComplete_list_${idx}`;
      console.log(`[TagInput:${uniqueId}] injecting styles with idx=${idx}, listId=${listId}`);
      injectAutocompleteStyles(idx);

      // Tab handler — stored in ref so sync cleanup can remove it
      const handleKeydown = (event) => {
        if (event.key === 'Tab' && acRef.current && acRef.current.isOpen) {
          event.preventDefault();
          if (acRef.current.cursor < 0) acRef.current.goTo(0);
        }
      };
      handleKeydownRef.current = handleKeydown;
      textarea.addEventListener('keydown', handleKeydown);

      // Context menu handler — right-click opens the tag-selector modal
      cleanupContextMenuRef.current = suppressContextMenu(textarea, () => {
        if (!isTagDefinitionsLoaded()) return;
        setInitialSearchTerm(extractWordAtCursor(textarea));
        savedCursorPosRef.current = textarea.selectionStart;
        setShowTagPanel(true);
      });

    console.log(`[TagInput:${uniqueId}] constructing autoComplete — selector=#${uniqueId}, listId=${listId}`);
    console.log(`[TagInput:${uniqueId}] typeof autoComplete =`, typeof autoComplete);

    try {
        acRef.current = new autoComplete({
        selector: `#${uniqueId}`,
        placeHolder: placeholder,
        query: () => {
          const [startPos, endPos] = getCurrentTagBounds(textarea);
          const q = textarea.value.substring(startPos, endPos).trim();
          console.log(`[TagInput:${uniqueId}] query() → "${q}"`);
          return q;
        },
        data: { src: tags, cache: true },
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
              if (textarea.getAttribute('autocomplete') === 'off') return;
              if (acRef.current && !acRef.current.isOpen) return;
              switch (event.keyCode) {
                case 40: case 38:
                  event.preventDefault();
                  event.keyCode === 40 ? acRef.current.next() : acRef.current.previous();
                  break;
                case 13:
                  if (!acRef.current.submit) event.preventDefault();
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
              console.log(`[TagInput:${uniqueId}] autocomplete list opened`);
              if (textarea.getAttribute('autocomplete') === 'off') {
                acRef.current.close();
                return;
              }
              const caretPos = getCaretCoordinates(textarea, textarea.selectionStart);
              const list = acRef.current.list;
              console.log(`[TagInput:${uniqueId}] list element:`, list, `listId in DOM:`, list?.id);
              const rect = textarea.getBoundingClientRect();
              list.style.position = 'fixed';
              list.style.left = (rect.left + caretPos.left) + 'px';
              list.style.top = (rect.top + caretPos.top + caretPos.height - textarea.scrollTop) + 'px';
              list.style.zIndex = '20000';
            },
            selection: (event) => {
              console.log(`[TagInput:${uniqueId}] selection:`, event.detail.selection.value);
              if (textarea.getAttribute('autocomplete') === 'off') return;
              const selection = event.detail.selection.value;
              const currentText = textarea.value;
              const [startPos, endPos] = getCurrentTagBounds(textarea);
              const textBefore = currentText.substring(0, startPos);
              const textAfter = currentText.substring(endPos);
              textarea.value = textBefore + (textBefore === '' ? '' : ' ') + selection + ', ' + textAfter.replace(/^,\s?/, '');
              const newCursorPos = startPos + selection.length + 2;
              textarea.setSelectionRange(newCursorPos, newCursorPos);
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
      });
        console.log(`[TagInput:${uniqueId}] autoComplete instance created:`, acRef.current);
        console.log(`[TagInput:${uniqueId}] internal id (autoComplete.instances counter):`, acRef.current?.id);
        console.log(`[TagInput:${uniqueId}] actual list DOM id:`, acRef.current?.list?.id);
      } catch (err) {
        console.error(`[TagInput:${uniqueId}] autoComplete construction failed:`, err);
      }
    }; // end initAutoComplete

    return () => {
      cancelled = true;
      console.log(`[TagInput:${uniqueId}] useEffect cleanup`);
      const ta = textareaRef.current;
      if (ta && handleKeydownRef.current) {
        ta.removeEventListener('keydown', handleKeydownRef.current);
        handleKeydownRef.current = null;
      }
      if (cleanupContextMenuRef.current) {
        cleanupContextMenuRef.current();
        cleanupContextMenuRef.current = null;
      }
      if (acRef.current) {
        acRef.current.unInit();
        acRef.current = null;
      }
    };
  }, []); // runs once on mount

  const handleInput = useCallback((e) => {
    if (onInput) onInput(e.target.value);
  }, [onInput]);

  const handleTagSelect = useCallback((tagName) => {
    const current = document.getElementById(uniqueId)?.value ?? '';
    const next = insertTagAtCursorPos(current, tagName, savedCursorPosRef.current);
    if (onInput) onInput(next);
    setShowTagPanel(false);
  }, [uniqueId, onInput]);

  const handleTagReplace = useCallback((tagName) => {
    const current = document.getElementById(uniqueId)?.value ?? '';
    const next = replaceTagInPrompt(current, initialSearchTerm, tagName);
    if (onInput) onInput(next);
    setShowTagPanel(false);
  }, [uniqueId, onInput, initialSearchTerm]);

  return html`
    <${FormGroup}>
      ${label ? html`<${Label} for=${uniqueId}>${label}</${Label}>` : null}
      <${StyledTextarea}
        id=${uniqueId}
        rows=${rows}
        placeholder=${placeholder}
        disabled=${disabled}
        value=${value}
        onInput=${handleInput}
        ...${rest}
      />
      <${TagSelectorPanel}
        isOpen=${showTagPanel}
        initialSearchTerm=${initialSearchTerm}
        onSelect=${handleTagSelect}
        onReplace=${handleTagReplace}
        onClose=${() => setShowTagPanel(false)}
      />
    </${FormGroup}>
  `;
}
