import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { styled } from '../../custom-ui/goober-setup.mjs';
import { Textarea } from '../../custom-ui/io/textarea.mjs';
import { Input } from '../../custom-ui/io/input.mjs';
import { Button } from '../../custom-ui/io/button.mjs';
import { SeedControl } from '../seed-control.mjs';
import { createExtraInputsRenderer } from '../extra-inputs-renderer.mjs';
import { getThemeValue } from '../../custom-ui/theme.mjs';
import { createTagSelectionHandler } from '../tags/tag-insertion-util.mjs';
import { TagSelectorPanel } from '../tags/tag-selector-panel.mjs';
import { suppressContextMenu } from '../../custom-ui/util.mjs';
import { isTagDefinitionsLoaded } from '../tags/tag-data.mjs';

// Styled components
const FormContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${getThemeValue('spacing.medium.gap')};
  width: 100%;
`;
FormContainer.className = 'form-container';

const FormRow = styled('div')`
  display: flex;
  gap: ${getThemeValue('spacing.medium.gap')};
  align-items: ${props => props.alignItems || 'flex-end'};
  flex-wrap: wrap;
  ${props => props.justifyContent ? `justify-content: ${props.justifyContent};` : ''}
`;
FormRow.className = 'form-row';

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

  // State for tag selector panel
  const [showTagPanel, setShowTagPanel] = useState(false);
  const textareaRef = useRef(null);

  // Set up contextmenu listener for tag selector
  useEffect(() => {
    const textarea = document.getElementById('description');
    if (!textarea) return;

    textareaRef.current = textarea;

    const cleanup = suppressContextMenu(textarea, () => {
      // Only show panel if workflow has autocomplete enabled and tags are loaded
      if (!workflow?.autocomplete || !isTagDefinitionsLoaded()) {
        return; // Right-click suppressed, but no panel shown
      }

      // Show the tag selector panel
      setShowTagPanel(true);
    });

    return cleanup;
  }, [workflow]);

  const handleChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.value);
  };

  // Handler for tag selection from tag selector panel
  const handleTagSelect = (tagName) => {
    const handler = createTagSelectionHandler(
      () => formState.description || '',
      (newValue) => onFieldChange('description', newValue)
    );
    handler(tagName);
  };

  // Handler to close tag panel
  const handleCloseTagPanel = () => {
    setShowTagPanel(false);
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

        <${SeedControl}
          seed=${formState.seed || -1}
          setSeed=${(newSeed) => onFieldChange('seed', newSeed)}
          locked=${formState.seedLocked || false}
          setLocked=${(locked) => onFieldChange('seedLocked', locked)}
          disabled=${isGenerating}
        />

        <div>
          <${Input}
            label="Name"
            type="text"
            widthScale="full"
            placeholder="Enter name"
            value=${formState.name || ''}
            onChange=${handleChange('name')}
            disabled=${isGenerating}
          />
        </div>



        <!-- Extra Inputs (standard types: text, number, select, checkbox) -->
        ${workflow?.extraInputs ? renderExtraInputs(workflow.extraInputs, 'standard') : null}
      </${FormRow}>

      <!-- Prompt -->
      <${Textarea}
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
        </${Button}>
      </${FormRow}>

      <!-- Tag Selector Panel -->
      <${TagSelectorPanel}
        isOpen=${showTagPanel}
        onSelect=${handleTagSelect}
        onClose=${handleCloseTagPanel}
      />

    </${FormContainer}>
  `;
}
