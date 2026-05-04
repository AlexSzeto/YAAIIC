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
import { injectAutocompleteStyles } from './autocomplete-styles.mjs';

// ============================================================================
// Module-level instance tracking (one instance per mounted component)
// ============================================================================

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
 */
export function AutocompleteInput({ label, placeholder, suggestions, onSelect }) {
  // Stable id – created once per mount, never changes across renders
  const inputIdRef = useRef('autocomplete-input-' + Math.random().toString(36).slice(2));
  const instanceRef = useRef(null);
  const styleIdRef = useRef(null);
  const onSelectRef = useRef(onSelect);

  // Keep onSelect ref current so the closure inside autoComplete.js always
  // calls the latest prop without needing to tear down and re-initialize.
  onSelectRef.current = onSelect;

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
                if (instance.cursor >= 0) {
                  event.preventDefault();
                  instance.select();
                }
                break;
              case 9: // Tab
                if (instance.cursor >= 0) {
                  event.preventDefault();
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

  // Handle Tab/Enter on the raw input when the dropdown is NOT open
  // (i.e. user typed something without selecting from the list)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const inst = instanceRef.current;
      const isOpen = inst && inst.isOpen;
      const hasCursor = inst && inst.cursor >= 0;

      // If dropdown is open and has a selection, let the autoComplete keydown handle it
      if (isOpen && hasCursor) return;

      // Otherwise treat Tab/Enter as "confirm typed value"
      const current = e.target.value.trim();
      if (current) {
        e.preventDefault();
        if (isOpen) inst.close();
        // Clear native input
        e.target.value = '';
        e.target.dispatchEvent(new Event('input', { bubbles: true }));
        onSelectRef.current?.(current);
      }
    }
  }, []);

  return html`
    <${Input}
      id=${inputIdRef.current}
      label=${label}
      placeholder=${placeholder}
      onKeyDown=${handleKeyDown}
      widthScale="full"
    />
  `;
}
