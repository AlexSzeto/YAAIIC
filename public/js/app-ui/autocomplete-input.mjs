/**
 * autocomplete-input.mjs – Reusable autocomplete text input component.
 *
 * Wraps autoComplete.js with fixed-position dropdown placement and the
 * project-standard autocomplete styles (injectAutocompleteStyles). Accepts
 * an arbitrary string array as `suggestions` and fires `onSelect` when the
 * user picks a suggestion or confirms a typed value with Tab/Enter.
 *
 * The inner <input> element is identified by a stable, random id so that
 * autoComplete.js can attach to the real DOM node without any styled-component
 * ref issues (see goober-styled-ref rule).
 */
import { html } from 'htm/preact';
import { useEffect, useRef, useCallback } from 'preact/hooks';
import { Input } from '../custom-ui/io/input.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { styled } from '../custom-ui/goober-setup.mjs';
import { injectAutocompleteStyles } from './autocomplete-styles.mjs';

// ============================================================================
// Styled Components
// ============================================================================

import { currentTheme } from '../custom-ui/theme.mjs';

const InputRow = styled('div')`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
`;
InputRow.className = 'autocomplete-input-row';

const InputFlex = styled('div')`
  flex: 1;
  min-width: 0;
`;
InputFlex.className = 'autocomplete-input-flex';

const ButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 44px;
`;
ButtonWrapper.className = 'autocomplete-input-button-wrapper';

/**
 * AutocompleteInput – themed input with autoComplete.js-powered dropdown.
 *
 * @param {Object}   props
 * @param {string}   [props.label]       – Label text above the input
 * @param {string}   [props.placeholder] – Placeholder text
 * @param {string[]} props.suggestions   – Array of suggestion strings
 * @param {string}   props.value         – Controlled value
 * @param {Function} props.onInput       – Called with the synthetic input event on every keystroke
 * @param {Function} props.onSelect      – Called with the selected string when the user picks a suggestion
 *                                         or confirms a typed value via Tab/Enter
 * @returns {preact.VNode}
 *
 * @example
 * <${AutocompleteInput}
 *   label="Add Part from Library"
 *   placeholder="Type to search saved parts..."
 *   suggestions=${libraryParts.map(p => p.name)}
 *   value=${inputValue}
 *   onInput=${(e) => setInputValue(e.target.value)}
 *   onSelect=${(name) => handleAddPart(name)}
 * />
 * @param {boolean}  [props.disabled]    – When true, disables the input and suppresses all autocomplete behaviour
 */
export function AutocompleteInput({ label, placeholder, suggestions, onSelect, disabled = false }) {
  // Stable id – created once per mount, never changes across renders
  const inputIdRef = useRef('autocomplete-input-' + Math.random().toString(36).slice(2));
  const instanceRef = useRef(null);
  const styleIdRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  // Always holds the latest suggestions array for use in the keydown handler
  const suggestionsRef = useRef(suggestions || []);
  suggestionsRef.current = suggestions || [];

  // Keep onSelect ref current so the closure inside autoComplete.js always
  // calls the latest prop without needing to tear down and re-initialize.
  onSelectRef.current = onSelect;

  // When disabled, close any open dropdown immediately.
  useEffect(() => {
    if (disabled && instanceRef.current?.isOpen) {
      instanceRef.current.close();
    }
  }, [disabled]);

  // Stable key derived from suggestion content — only changes when the list actually changes.
  // Using a plain array reference would re-init on every render (new array each call).
  const suggestionsKey = (suggestions || []).join('\x00');

  // Initialize autoComplete.js once on mount; update data when suggestions change.
  useEffect(() => {
    const inputId = inputIdRef.current;

    // Clean up any previous instance before creating a new one
    function cleanup() {
      if (instanceRef.current) {
        try {
          const list = instanceRef.current.list;
          if (list && list.parentNode) list.parentNode.removeChild(list);
          instanceRef.current.unInit();
        } catch (_) { /* ignore */ }
        instanceRef.current = null;
      }
      if (styleIdRef.current !== null) {
        const styleTag = document.getElementById('autocomplete-styles-' + styleIdRef.current);
        if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
        styleIdRef.current = null;
      }
    }

    cleanup();

    // Wait for the DOM element to be available (rendered by Input above)
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    const instance = new autoComplete({
      selector: `#${inputId}`,
      wrapper: false, // Disable built-in .autoComplete_wrapper div; InputFlex provides our own container
      placeHolder: placeholder || '',
      data: {
        src: suggestions || [],
        cache: false,
      },
      resultsList: {
        maxResults: 20,
        tabSelect: true,
        destination: () => document.body,
        position: 'afterbegin',
      },
      resultItem: {
        highlight: true,
      },
      events: {
        input: {
          open: () => {
            // Position dropdown below the input using fixed coords (avoids stacking context issues)
            const list = instance.list;
            if (list) {
              const el = document.getElementById(inputId);
              if (el) {
                const rect = el.getBoundingClientRect();
                list.style.position = 'fixed';
                list.style.left = rect.left + 'px';
                list.style.top = (rect.bottom + 4) + 'px';
                list.style.width = rect.width + 'px';
                list.style.zIndex = '20000';
              }
            }
          },
          selection: (event) => {
            const selected = event.detail.selection.value;
            // Sync the native input value then fire onSelect
            const el = document.getElementById(inputId);
            if (el) {
              el.value = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
            onSelectRef.current?.(selected);
          },
          keydown: (event) => {
            if (!instance || !instance.isOpen) return;
            switch (event.keyCode) {
              case 40: // Down
              case 38: // Up
                event.preventDefault();
                event.keyCode === 40 ? instance.next() : instance.previous();
                break;
              case 13: // Enter
                
                break;
              case 9: // Tab
                if (instance.isOpen) {
                  event.preventDefault();
                  // If no item is highlighted yet, advance to the first result
                  if (instance.cursor < 0) instance.next();
                  instance.select();
                }
                break;
              case 27: // Esc
                instance.close();
                break;
            }
          },
        },
      },
    });

    instanceRef.current = instance;
    styleIdRef.current = instance.id;
    injectAutocompleteStyles(instance.id);

    return cleanup;
  // Re-initialize when suggestion content changes (not just array reference)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionsKey]);

  // Handle Tab/Enter on the raw input.
  // Enter always commits the raw typed value (ignoring autocomplete suggestions).
  // Tab completes to the first matching suggestion when the dropdown is closed;
  // when it is open the internal autoComplete keydown handler takes care of it.
  const handleKeyDown = useCallback((e) => {
    if (disabled) return;

    if (e.key === 'Enter') {
      // Close any open dropdown, then commit the raw typed value as-is
      const inst = instanceRef.current;
      if (inst && inst.isOpen) inst.close();
      const current = e.target.value.trim();
      if (current) {
        e.preventDefault();
        e.target.value = '';
        e.target.dispatchEvent(new Event('input', { bubbles: true }));
        onSelectRef.current?.(current);
      }
      return;
    }

    if (e.key === 'Tab') {
      const inst = instanceRef.current;
      const isOpen = inst && inst.isOpen;

      // Dropdown is open — let the internal autoComplete keydown handle it
      if (isOpen) return;

      // Dropdown is closed — complete to the first matching suggestion
      const current = e.target.value.trim();
      if (current) {
        const firstMatch = suggestionsRef.current.find(
          s => s.toLowerCase().includes(current.toLowerCase())
        );
        e.preventDefault();
        e.target.value = '';
        e.target.dispatchEvent(new Event('input', { bubbles: true }));
        onSelectRef.current?.(firstMatch ?? current);
      }
    }
  }, [disabled]);

  // Confirm button handler — commits the raw typed value as-is, same as Enter
  const handleConfirm = useCallback(() => {
    if (disabled) return;
    const el = document.getElementById(inputIdRef.current);
    if (!el) return;
    const current = el.value.trim();
    if (current) {
      const inst = instanceRef.current;
      if (inst && inst.isOpen) inst.close();
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      onSelectRef.current?.(current);
    }
  }, [disabled]);

  return html`
    <${InputRow}>
      <${InputFlex}>
        <${Input}
          id=${inputIdRef.current}
          label=${label}
          placeholder=${placeholder}
          onKeyDown=${handleKeyDown}
          disabled=${disabled}
          widthScale="full"
        />
      </${InputFlex}>
      <${ButtonWrapper}>
        <${Button}
          variant="medium-icon"
          icon="check"
          disabled=${disabled}
          onClick=${handleConfirm}
        />
      </${ButtonWrapper}>
    </${InputRow}>
  `;
}
