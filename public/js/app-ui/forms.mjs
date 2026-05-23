import { useState, useCallback } from 'preact/hooks';

function defaultEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Computes the standard three-button form state from `recorded` and `dirty`.
 *
 * recorded — the entry exists in the database (has a uid present in the server's list)
 * dirty    — current form data differs from the last saved baseline
 *
 * @param {boolean} recorded
 * @param {boolean} dirty
 * @returns {{ saveLabel: string, saveEnabled: boolean, deleteEnabled: boolean, revertEnabled: boolean }}
 */
export function formButtonStates(recorded, dirty) {
  return {
    saveLabel: recorded ? 'Save' : 'Create',
    saveEnabled: dirty,
    deleteEnabled: recorded,
    revertEnabled: recorded && dirty,
  };
}

/**
 * Hook that manages saved-data state and computes standard form button states.
 * Stores the last-saved data snapshot internally; call markSaved / reset when
 * the saved state changes.
 *
 * @param {*} currentData - Reactive current form data (used for dirty comparison)
 * @param {*} initialSavedData - Baseline for the initial dirty check
 * @param {Object} [options]
 * @param {boolean} [options.recorded=false] - Whether the record exists in the DB at init
 * @param {Function} [options.equals] - Custom equality function (defaults to JSON.stringify)
 */
export function useFormRecord(currentData, initialSavedData, options = {}) {
  const { recorded: initialRecorded = false, equals = defaultEquals } = options;
  const [savedData, setSavedData] = useState(
    () => (initialSavedData !== undefined ? initialSavedData : currentData)
  );
  const [recorded, setRecorded] = useState(initialRecorded);

  const dirty = !equals(currentData, savedData);
  const states = formButtonStates(recorded, dirty);

  const markSaved = useCallback((data) => {
    setSavedData(data);
    setRecorded(true);
  }, []);

  const reset = useCallback((blankData) => {
    setSavedData(blankData);
    setRecorded(false);
  }, []);

  return {
    savedData,
    recorded,
    dirty,
    ...states,
    markSaved,
    reset,
  };
}
