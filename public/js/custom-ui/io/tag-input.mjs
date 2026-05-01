/**
 * tag-input.mjs – Reusable autocomplete tag-input component.
 *
 * Wraps the autoComplete.js library so multiple instances can coexist on the
 * same page.  Each instance gets its own style sheet (scoped by a unique
 * index) and a scoped selector so DOM IDs never collide.
 *
 * @module custom-ui/io/tag-input
 */
import { html } from 'htm/preact';
import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import { styled } from '../goober-setup.mjs';
import { currentTheme, getThemeValue } from '../theme.mjs';
import { getTags } from '../../app-ui/tags/tags.mjs';
import { injectAutocompleteStyles } from '../../app-ui/autocomplete-styles.mjs';
import '../../app-ui/textarea-caret-position-wrapper.mjs';

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
 * TagInput – Reusable tag autocomplete textarea.
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

  // Keep track of injected style index
  const styleIndexRef = useRef(instanceCounter);

  // Initialise autoComplete.js once the <textarea> is in the DOM
  useEffect(() => {
    const textarea = document.getElementById(uniqueId);
    if (!textarea) return;
    textareaRef.current = textarea;

    const tags = getTags();
    if (tags.length === 0) return;

    const idx = styleIndexRef.current;
    injectAutocompleteStyles(idx);

    // Tab handler
    const handleKeydown = (event) => {
      if (event.key === 'Tab' && acRef.current && acRef.current.isOpen) {
        event.preventDefault();
        if (acRef.current.cursor < 0) acRef.current.goTo(0);
      }
    };
    textarea.addEventListener('keydown', handleKeydown);

    acRef.current = new autoComplete({
      selector: `#${uniqueId}`,
      placeHolder: placeholder,
      query: () => {
        const [startPos, endPos] = getCurrentTagBounds(textarea);
        return textarea.value.substring(startPos, endPos).trim();
      },
      data: { src: tags, cache: true },
      resultsList: {
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
            if (textarea.getAttribute('autocomplete') === 'off') {
              acRef.current.close();
              return;
            }
            const caretPos = getCaretCoordinates(textarea, textarea.selectionStart);
            const list = acRef.current.list;
            const rect = textarea.getBoundingClientRect();
            list.style.position = 'fixed';
            list.style.left = (rect.left + caretPos.left) + 'px';
            list.style.top = (rect.top + caretPos.top + caretPos.height - textarea.scrollTop) + 'px';
            list.style.zIndex = '20000';
          },
          selection: (event) => {
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

    return () => {
      textarea.removeEventListener('keydown', handleKeydown);
      if (acRef.current) {
        acRef.current.unInit();
        acRef.current = null;
      }
    };
  }, []); // runs once on mount

  const handleInput = useCallback((e) => {
    if (onInput) onInput(e.target.value);
  }, [onInput]);

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
    </${FormGroup}>
  `;
}
