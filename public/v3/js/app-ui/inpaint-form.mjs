import { html } from 'htm/preact';
import { styled } from '../custom-ui/goober-setup.mjs';
import { Textarea } from '../custom-ui/io/textarea.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { SeedControl } from './seed-control.mjs';
import { createExtraInputsRenderer } from './extra-inputs-renderer.mjs';
import { getThemeValue } from '../custom-ui/theme.mjs';

// Styled components
const FormContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${getThemeValue('spacing.medium.gap')};
  width: 100%;
`;

const FormRow = styled('div')`
  display: flex;
  gap: ${getThemeValue('spacing.medium.gap')};
  align-items: ${props => props.alignItems || 'flex-end'};
  flex-wrap: wrap;
  ${props => props.justifyContent ? `justify-content: ${props.justifyContent};` : ''}
`;

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
  
  // Create renderExtraInputs function using the reusable renderer
  const renderExtraInputs = createExtraInputsRenderer(formState, onFieldChange, isGenerating);
  
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
    <${FormContainer}>
      
      <!-- Row 1: Name, Seed, Lock -->
      <${FormRow} key="name-seed-row">
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
        
        <!-- Extra Inputs (standard types: text, number, select, checkbox) -->
        ${workflow?.extraInputs ? renderExtraInputs(workflow.extraInputs, 'standard') : null}
      <//>

      <!-- Prompt -->
      <${Textarea}
        key="description"
        label="Prompt"
        id="description"
        autocomplete=${workflow?.autocomplete ? undefined : 'off'}
        placeholder="Enter your text here..."
        value=${formState.description || ''}
        onChange=${handleChange('description')}
        disabled=${isGenerating}
      />

      <!-- Extra Textarea Inputs (after description) -->
      ${workflow?.extraInputs ? renderExtraInputs(workflow.extraInputs, 'textarea') : null}

      <!-- Action Buttons -->
      <${FormRow} key="button-row" justifyContent="flex-start">
        <${Button} 
          variant="primary"
          icon="play"
          onClick=${onGenerate}
          loading=${isGenerating}
          disabled=${isInpaintDisabled}
        >
          ${isGenerating ? 'Inpainting...' : 'Inpaint'}
        <//>
      <//>

    <//>
  `;
}
