import { useState } from 'preact/hooks';
import { html } from 'htm/preact';
import { Button } from '../custom-ui/button.mjs';
import { sendToClipboard } from '../util.mjs';
import { createImageModal } from '../custom-ui/modal.mjs';

export function GeneratedResult({ 
  image, 
  onUseSeed,
  onUsePrompt,
  onUseWorkflow,
  onUseName,
  onUseDescription,
  onDelete,
  onInpaint,
  onSelectAsInput,
  onEdit,
  isSelectDisabled = false
}) {
  if (!image) return null;

  // Track which field is currently being edited
  // { field: string | null }
  const [editingField, setEditingField] = useState(null);
  
  const handleCopy = (text, label) => {
    if (!text) return;
    sendToClipboard(text, `${label} copied to clipboard`);
  };

  const startEditing = (field) => {
    setEditingField(field);
  };

  const stopEditing = () => {
    setEditingField(null);
  };

  const handleSave = (field, value) => {
    if (onEdit) {
      onEdit(image.uid, field, value);
    }
    stopEditing();
  };

  return html`
    <div className="generated-image-display content-container" style="display: block;">
      <h3 className="generated-result-title">Generated Result</h3>
      
      <div className="generated-image-content">
        <div className="generated-image-left">
          <img 
            src=${image.imageUrl} 
            alt=${image.name || 'Generated Image'} 
            className="generated-image"
            style="cursor: pointer;"
            onClick=${() => createImageModal(image.imageUrl, true, image.name)}
          />
        </div>

        <div className="generated-image-right">
          <${InfoField} 
            label="Workflow" 
            field="workflow"
            value=${image.workflow} 
            onCopy=${() => handleCopy(image.workflow, 'Workflow')}
            onUse=${() => onUseWorkflow && onUseWorkflow(image.workflow)}
            useTitle="Use this workflow"
            canEdit=${false} 
          />
          
          <${InfoField} 
            label="Name" 
            field="name"
            value=${image.name} 
            isEditing=${editingField === 'name'}
            onEditStart=${() => startEditing('name')}
            onCancel=${stopEditing}
            onSave=${(val) => handleSave('name', val)}
            onCopy=${() => handleCopy(image.name, 'Name')}
            onUse=${() => onUseName && onUseName(image.name)}
            useTitle="Use this name"
            canEdit=${true}
          />
          
          <${InfoField} 
            label="Tags" 
            field="tags"
            value=${Array.isArray(image.tags) ? image.tags.join(', ') : image.tags} 
            isTextarea=${true}
            isEditing=${editingField === 'tags'}
            onEditStart=${() => startEditing('tags')}
            onCancel=${stopEditing}
            onSave=${(val) => handleSave('tags', val)}
            onCopy=${() => handleCopy(Array.isArray(image.tags) ? image.tags.join(', ') : image.tags, 'Tags')}
            canEdit=${true}
            /* Explicitly no onUse for Tags as requested */
          />
          
          <${InfoField} 
            label="Prompt" 
            field="prompt"
            value=${image.prompt} 
            isTextarea=${true}
            isEditing=${editingField === 'prompt'}
            onEditStart=${() => startEditing('prompt')}
            onCancel=${stopEditing}
            onSave=${(val) => handleSave('prompt', val)}
            onCopy=${() => handleCopy(image.prompt, 'Prompt')}
            onUse=${() => onUsePrompt && onUsePrompt(image.prompt)}
            useTitle="Use this prompt"
            canEdit=${true}
          />
          
          <${InfoField} 
            label="Description" 
            field="description"
            value=${image.description} 
            isTextarea=${true}
            isEditing=${editingField === 'description'}
            onEditStart=${() => startEditing('description')}
            onCancel=${stopEditing}
            onSave=${(val) => handleSave('description', val)}
            onCopy=${() => handleCopy(image.description, 'Description')}
            onUse=${() => onUseDescription && onUseDescription(image.description)}
            useTitle="Use this description"
            canEdit=${true}
          />
          
          <${InfoField} 
            label="Seed" 
            field="seed"
            value=${image.seed} 
            onCopy=${() => handleCopy(image.seed, 'Seed')}
            onUse=${() => onUseSeed && onUseSeed(image.seed)}
            useTitle="Use this seed"
            canEdit=${false}
          />
        </div>
      </div>

      <div className="image-action-container">
        <${Button} 
          className="image-select-btn"
          icon="check-circle"
          onClick=${() => onSelectAsInput && onSelectAsInput(image)}
          disabled=${!onSelectAsInput || isSelectDisabled}
          title="Use this image as input"
        >
          Select
        <//>
        <${Button} 
          className="image-inpaint-btn" 
          icon="image"
          onClick=${() => onInpaint && onInpaint(image)}
          disabled=${!image.uid || !onInpaint}
          title="Inpaint this image"
        >
          Inpaint
        <//>
        <${Button} 
          className="image-delete-btn"
          icon="trash"
          onClick=${() => onDelete && onDelete(image)}
          disabled=${!image.uid || !onDelete}
          title="Delete this image"
        >
          Delete
        <//>
      </div>
    </div>
  `;
}

function InfoField({ 
  label, 
  value, 
  isTextarea = false, 
  onCopy, 
  onUse, 
  useTitle,
  canEdit = false,
  isEditing = false,
  onEditStart,
  onSave,
  onCancel
}) {
  const [editValue, setEditValue] = useState(value || '');
  
  if (isEditing && editValue === undefined) {
      setEditValue(value || '');
  }
  
  const handleEditClick = () => {
    setEditValue(value || '');
    onEditStart();
  };

  const handleSaveClick = () => {
      onSave(editValue);
  };

  const labelLower = label.toLowerCase();
  const fieldClass = labelLower === 'tags' ? 'info-tags-field' : `info-${labelLower}`;

  return html`
    <div className="info-section">
      <div className="info-header">
        <label className="info-label">${label}:</label>
        <div className="info-buttons">
          ${!isEditing ? html`
            <button 
              className="info-btn copy-btn" 
              onClick=${onCopy} 
              title="Copy ${label}" 
              disabled=${!onCopy}
            >
              <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
            </button>
            <button 
              className="info-btn use-btn" 
              onClick=${onUse} 
              title=${useTitle || `Use ${label}`} 
              disabled=${!onUse}
            >
              <box-icon name='up-arrow-circle' color='#ffffff' size='16px'></box-icon>
            </button>
            <button 
              className="info-btn edit-btn" 
              onClick=${canEdit ? handleEditClick : null} 
              title="Edit"
              disabled=${!canEdit}
            >
              <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
            </button>
          ` : html`
             <button className="info-btn confirm-edit-btn" onClick=${handleSaveClick} title="Save" style="background-color: #28a745;">
               <box-icon name='check' color='#ffffff' size='16px'></box-icon>
             </button>
             <button className="info-btn cancel-edit-btn" onClick=${onCancel} title="Cancel" style="background-color: #dc3545;">
               <box-icon name='x' color='#ffffff' size='16px'></box-icon>
             </button>
          `}
        </div>
      </div>
      ${isTextarea 
        ? html`
            <textarea 
                className="info-field ${fieldClass} ${isEditing ? 'editing' : ''}" 
                readOnly=${!isEditing} 
                value=${isEditing ? editValue : (value || '')}
                onInput=${(e) => setEditValue(e.target.value)}
            ></textarea>`
        : html`
            <input 
                type="text" 
                className="info-field ${fieldClass} ${isEditing ? 'editing' : ''}" 
                readOnly=${!isEditing} 
                value=${isEditing ? editValue : (value || '')}
                onInput=${(e) => setEditValue(e.target.value)}
            />`
      }
    </div>
  `;
}
