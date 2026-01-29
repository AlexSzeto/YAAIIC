import { html } from 'htm/preact';
import { Textarea } from '../custom-ui/textarea.mjs';
import { Input } from '../custom-ui/input.mjs';
import { Button } from '../custom-ui/button.mjs';
import { SeedControl } from './seed-control.mjs';
import { ImageSelect } from '../custom-ui/image-select.mjs';
import { AudioSelect } from '../custom-ui/audio-select.mjs';
import { createExtraInputsRenderer } from './extra-inputs-renderer.mjs';

/**
 * Generation Form Component
 * Orchestrates all input fields for image/video generation
 * 
 * @param {Object} props
 * @param {Object|null} props.workflow - Selected workflow object
 * @param {Object} props.formState - Form field values
 * @param {Function} props.onFieldChange - Callback for field changes: (fieldName, value) => void
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Function} props.onGenerate - Callback for generate action
 * @param {Function} [props.onOpenGallery] - Callback to open gallery
 * @param {Function} [props.onUploadClick] - Callback for upload button
 */
export function GenerationForm({ 
  workflow, 
  formState, 
  onFieldChange, 
  isGenerating, 
  onGenerate, 
  onOpenGallery, 
  onUploadClick,
  inputImages = [],
  onImageChange,
  onSelectFromGallery,
  inputAudios = [],
  onAudioChange,
  onSelectAudioFromGallery
}) {
  
  const handleChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.value);
  };

  const handleCheckboxChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.checked);
  };

  const isVideoWorkflow = workflow?.type === 'video';
  
  // Create renderExtraInputs function using the reusable renderer
  const renderExtraInputs = createExtraInputsRenderer(formState, onFieldChange, isGenerating);
  
  // Compute whether generate button should be disabled
  const isGenerateDisabled = (() => {
    // Disabled while generating
    if (isGenerating) return true;
    // Disabled if no workflow selected
    if (!workflow) return true;
    // Disabled if name is required but not provided
    if (workflow.nameRequired && !formState.name?.trim()) return true;
    // Disabled if prompt is required but not provided
    if (!workflow.optionalPrompt && !formState.description?.trim()) return true;
    // Disabled if images are required but not all provided
    if (workflow.inputImages && workflow.inputImages > 0) {
      const filledCount = inputImages.filter(img => img && (img.blob || img.url)).length;
      if (filledCount < workflow.inputImages) return true;
    }
    // Disabled if audios are required but not all provided
    if (workflow.inputAudios && workflow.inputAudios > 0) {
      const filledCount = inputAudios.filter(audio => audio && (audio.blob || audio.url)).length;
      if (filledCount < workflow.inputAudios) return true;
    }
    return false;
  })();

  return html`
    <div class="generation-form" style="display: flex; flex-direction: column; gap: 15px; width: 100%;">
      
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

        ${workflow?.extraInputs ? html`
          ${renderExtraInputs(workflow.extraInputs, 'standard')}
      ` : null}
      </div>

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
      ${workflow?.extraInputs && renderExtraInputs(workflow.extraInputs, 'textarea')}

      <!-- Row 3: Image Upload -->
      ${workflow?.inputImages > 0 && html`
        <div id="image-upload-container" class="form-row" style="display: flex; gap: 15px; flex-wrap: wrap;">
          ${Array.from({ length: workflow.inputImages }, (_, i) => html`
            <${ImageSelect}
              key=${i}
              label=${workflow.inputImages > 1 ? `Image ${i + 1}` : 'Input Image'}
              value=${inputImages[i]?.url || inputImages[i]?.blob || null}
              onChange=${(fileOrUrl) => onImageChange && onImageChange(i, fileOrUrl)}
              onSelectFromGallery=${() => onSelectFromGallery && onSelectFromGallery(i)}
              disabled=${isGenerating}
            />
          `)}
        </div>
      `}

      <!-- Row 3.5: Audio Upload -->
      ${workflow?.inputAudios > 0 && html`
        <div id="audio-upload-container" class="form-row" style="display: flex; gap: 15px; flex-wrap: wrap;">
          ${Array.from({ length: workflow.inputAudios }, (_, i) => html`
            <${AudioSelect}
              key=${i}
              label=${workflow.inputAudios > 1 ? `Audio ${i + 1}` : 'Input Audio'}
              value=${inputAudios[i]?.mediaData || inputAudios[i]?.url || null}
              onChange=${(audioUrlOrData) => onAudioChange && onAudioChange(i, audioUrlOrData)}
              onSelectFromGallery=${() => onSelectAudioFromGallery && onSelectAudioFromGallery(i)}
              disabled=${isGenerating}
            />
          `)}
        </div>
      `}

      <!-- Row 4: Action Buttons -->
      <!-- Row 4: Action Buttons (V1 Style) -->
      <div id="action-buttons-container" class="form-row button-row" style="display: flex; gap: 15px; align-items: center; justify-content: flex-start;">
        <${Button} 
          variant="primary"
          icon="play"
          onClick=${onGenerate}
          loading=${isGenerating}
          disabled=${isGenerateDisabled}
        >
          ${isGenerating ? 'Generating...' : 'Generate'}
        <//>



        <${Button} 
          variant="primary"
          icon="upload"
          title="Upload Media"
          onClick=${onUploadClick || (() => document.getElementById('upload-file-input')?.click())}
          disabled=${isGenerating}
        >
          Upload
        <//>
      </div>

    </div>
  `;
}
