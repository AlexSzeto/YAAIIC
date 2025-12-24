// InpaintForm - Form component for inpaint parameters
import { html } from 'htm/preact';
import { Textarea } from '../custom-ui/textarea.mjs';
import { Input } from '../custom-ui/input.mjs';
import { Button } from '../custom-ui/button.mjs';
import { SeedControl } from './seed-control.mjs';

/**
 * InpaintForm Component
 * 
 * @param {Object} props
 * @param {Object|null} props.workflow - Selected workflow object
 * @param {Object} props.formState - Form field values
 * @param {Function} props.onFieldChange - Callback for field changes
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Function} props.onGenerate - Callback for inpaint action
 * @param {boolean} props.hasValidInpaintArea - Whether a valid inpaint area is selected
 */
export function InpaintForm({ 
  workflow, 
  formState, 
  onFieldChange, 
  isGenerating, 
  onGenerate,
  hasValidInpaintArea
}) {
  
  const handleChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.value);
  };
  
  // Compute whether inpaint button should be disabled
  const isInpaintDisabled = (() => {
    // Disabled while generating
    if (isGenerating) return true;
    // Disabled if no workflow selected
    if (!workflow) return true;
    // Disabled if no inpaint area selected
    if (!hasValidInpaintArea) return true;
    // Disabled if name is required but not provided
    if (workflow.nameRequired && !formState.name?.trim()) return true;
    // Disabled if prompt is required but not provided
    if (!workflow.optionalPrompt && !formState.description?.trim()) return true;
    return false;
  })();

  return html`
    <div class="inpaint-form" style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
      
      <!-- Row 1: Name, Seed, Lock -->
      <div class="form-row" style="display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap;">
        <div>
          <${Input}
            label="Name"
            type="text"
            placeholder="Enter name"
            value=${formState.name || ''}
            onChange=${handleChange('name')}
            disabled=${isGenerating}
          />
        </div>

        <${SeedControl}
          seed=${formState.seed || -1}
          setSeed=${(newSeed) => onFieldChange('seed', newSeed)}
          locked=${formState.seedLocked || false}
          setLocked=${(locked) => onFieldChange('seedLocked', locked)}
          disabled=${isGenerating}
        />
      </div>

      <!-- Description -->
      <${Textarea}
        label="Description"
        id="description"
        autocomplete=${workflow?.autocomplete ? undefined : 'off'}
        placeholder="Enter your text here..."
        value=${formState.description || ''}
        onChange=${handleChange('description')}
        disabled=${isGenerating}
      />

      <!-- Action Buttons -->
      <div class="form-row button-row" style="display: flex; gap: 15px; align-items: center; justify-content: flex-start;">
        <${Button} 
          variant="primary"
          icon="play"
          onClick=${onGenerate}
          loading=${isGenerating}
          disabled=${isInpaintDisabled}
        >
          ${isGenerating ? 'Inpainting...' : 'Inpaint'}
        <//>
      </div>

    </div>
  `;
}
