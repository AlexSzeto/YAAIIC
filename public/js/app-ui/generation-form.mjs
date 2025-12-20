import { html } from 'htm/preact';
import { Textarea } from '../custom-ui/textarea.mjs';
import { Input } from '../custom-ui/input.mjs';
import { Select } from '../custom-ui/select.mjs';
import { Button } from '../custom-ui/button.mjs';
import { SeedControl } from './seed-control.mjs';

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
 */
export function GenerationForm({ workflow, formState, onFieldChange, isGenerating, onGenerate }) {
  
  const handleChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.value);
  };

  const isVideoWorkflow = workflow?.type === 'video';

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
          />
        </div>

        <${SeedControl}
          seed=${formState.seed || -1}
          setSeed=${(newSeed) => onFieldChange('seed', newSeed)}
          locked=${formState.seedLocked || false}
          setLocked=${(locked) => onFieldChange('seedLocked', locked)}
        />
      </div>

      <!-- Row 2: Video Controls (Conditional) -->
      ${isVideoWorkflow && html`
        <div class="form-row video-controls" style="display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap;">
          <${Input}
            label="Length (frames)"
            type="number"
            min="1"
            value=${formState.length || 25}
            onChange=${handleChange('length')}
          />
          
          <${Input}
            label="Frame Rate"
            type="number"
            min="1"
            max="60"
            step="1"
            value=${formState.framerate || 20}
            onChange=${handleChange('framerate')}
          />
          
          <${Select}
            label="Orientation"
            options=${[
              { label: 'Portrait', value: 'portrait' },
              { label: 'Landscape', value: 'landscape' }
            ]}
            value=${formState.orientation || 'portrait'}
            onChange=${handleChange('orientation')}
          />
        </div>
      `}

      <!-- Description -->
      <${Textarea}
        label="Description"
        id="description"
        autocomplete=${workflow?.autocomplete ? undefined : 'off'}
        placeholder="Enter your text here..."
        value=${formState.description || ''}
        onChange=${handleChange('description')}
      />

      <!-- Row 3: Image Upload (Placeholder) -->
      <div id="image-upload-container" class="form-row">
        <!-- Image upload controls will be injected here -->
      </div>

      <!-- Row 4: Action Buttons -->
      <!-- Row 4: Action Buttons (V1 Style) -->
      <div id="action-buttons-container" class="form-row button-row" style="display: flex; gap: 15px; align-items: center; justify-content: flex-start;">
        <${Button} 
          variant="primary"
          className="generate-button"
          icon="play"
          onClick=${onGenerate}
          loading=${isGenerating}
          disabled=${isGenerating || !workflow}
        >
          ${isGenerating ? 'Generating...' : 'Generate'}
        <//>

        <${Button} 
          variant="primary"
          className="gallery-btn"
          icon="image"
          title="Gallery"
          onClick=${() => document.getElementById('gallery-btn')?.click()}
        >
          Gallery
        <//>

        <${Button} 
          variant="primary"
          className="upload-btn"
          icon="upload"
          title="Upload Image"
          onClick=${() => document.getElementById('upload-btn')?.click()}
        >
          Upload
        <//>
      </div>

    </div>
  `;
}
