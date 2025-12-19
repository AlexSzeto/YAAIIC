import { html } from 'htm/preact';
import { Textarea } from '../custom-ui/textarea.mjs';
import { Input } from '../custom-ui/input.mjs';
import { Select } from '../custom-ui/select.mjs';
import { SeedControl } from './seed-control.mjs';

/**
 * Generation Form Component
 * Orchestrates all input fields for image/video generation
 * 
 * @param {Object} props
 * @param {Object|null} props.workflow - Selected workflow object
 * @param {Object} props.formState - Form field values
 * @param {Function} props.onFieldChange - Callback for field changes: (fieldName, value) => void
 */
export function GenerationForm({ workflow, formState, onFieldChange }) {
  
  const handleChange = (fieldName) => (e) => {
    onFieldChange(fieldName, e.target.value);
  };

  const isVideoWorkflow = workflow?.type === 'video';

  return html`
    <div class="generation-form">
      
      <${Input}
        label="Name"
        type="text"
        placeholder="Enter name"
        value=${formState.name || ''}
        onChange=${handleChange('name')}
      />

      <${SeedControl}
        seed=${formState.seed || -1}
        setSeed=${(newSeed) => onFieldChange('seed', newSeed)}
        locked=${formState.seedLocked || false}
        setLocked=${(locked) => onFieldChange('seedLocked', locked)}
      />

      ${isVideoWorkflow && html`
        <div class="video-controls-row" style="display: contents;">
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

      <${Textarea}
        label="Description"
        placeholder="Enter your text here..."
        value=${formState.description || ''}
        onChange=${handleChange('description')}
      />

    </div>
  `;
}
