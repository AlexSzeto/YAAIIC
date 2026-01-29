import { html } from 'htm/preact';
import { styled } from 'goober';
import { Textarea } from '../custom-ui/io/textarea.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Select } from '../custom-ui/io/select.mjs';
import { Checkbox } from '../custom-ui/io/checkbox.mjs';
import { getThemeValue } from '../custom-ui/theme.mjs';

const CheckboxWrapper = styled('div')`
  margin-bottom: ${getThemeValue('spacing.small.margin')};
`;

/**
 * Creates an extra inputs renderer function
 * Returns a function that can render extra inputs based on workflow configuration
 * 
 * @param {Object} formState - Form field values
 * @param {Function} onFieldChange - Callback for field changes: (fieldName, value) => void
 * @param {boolean} isGenerating - Whether generation is in progress
 * @returns {Function} renderExtraInputs function
 */
export function createExtraInputsRenderer(formState, onFieldChange, isGenerating) {
  const handleChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.value);
  };

  const handleCheckboxChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.checked);
  };

  /**
   * Render extra inputs dynamically based on workflow configuration
   * @param {Array} extraInputs - Array of extra input definitions
   * @param {string} inputType - Type filter: 'standard' for non-textarea, 'textarea' for textarea only
   * @returns {Array} Array of rendered input elements
   */
  return function renderExtraInputs(extraInputs, inputType = 'standard') {
    if (!extraInputs || !Array.isArray(extraInputs)) return [];
    
    return extraInputs
      .filter(input => {
        if (inputType === 'textarea') return input.type === 'textarea';
        if (inputType === 'standard') return input.type !== 'textarea';
        return false;
      })
      .map(input => {
        const value = formState[input.id];
        
        switch (input.type) {
          case 'text':
            return html`
              <${Input}
                key=${input.id}
                label=${input.label}
                type="text"
                value=${value || ''}
                onChange=${handleChange(input.id)}
                disabled=${isGenerating}
              />
            `;
            
          case 'number':
            return html`
              <${Input}
                key=${input.id}
                label=${input.label}
                type="number"
                value=${value !== undefined ? value : (input.default || '')}
                onChange=${handleChange(input.id)}
                disabled=${isGenerating}
              />
            `;
            
          case 'select':
            return html`
              <${Select}
                key=${input.id}
                label=${input.label}
                value=${value || input.default || ''}
                options=${input.options || []}
                onChange=${handleChange(input.id)}
                disabled=${isGenerating}
              />
            `;
            
          case 'checkbox':
            return html`
              <${CheckboxWrapper}>
              <${Checkbox}
                key=${input.id}
                label=${input.label}
                checked=${value !== undefined ? value : (input.default || false)}
                onChange=${handleCheckboxChange(input.id)}
                disabled=${isGenerating}
              />
              <//>
            `;
            
          case 'textarea':
            return html`
              <${Textarea}
                key=${input.id}
                label=${input.label}
                value=${value || ''}
                onChange=${handleChange(input.id)}
                disabled=${isGenerating}
              />
            `;
            
          default:
            return null;
        }
      });
  };
}
