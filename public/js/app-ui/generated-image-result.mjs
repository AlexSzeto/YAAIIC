import { h } from 'preact';
import { html } from 'htm/preact';
import { Button } from '../custom-ui/button.mjs';
import { sendToClipboard } from '../util.mjs';

export function GeneratedImageResult({ 
  image, // { imageUrl, seed, prompt, metadata, name, description, tags, uid, workflow }
  onUseSeed,
  onUsePrompt,
  onDelete,
  onInpaint,
  onSelectAsInput
}) {
  if (!image) return null;

  const handleCopy = (text, label) => {
    if (!text) return;
    sendToClipboard(text, `${label} copied to clipboard`);
  };

  return html`
    <div className="generated-image-display content-container" style="display: block;">
      <h3 className="generated-image-title">Generated Image</h3>
      
      <div className="generated-image-content">
        <div className="generated-image-left">
          <img 
            src=${image.imageUrl} 
            alt=${image.name || 'Generated Image'} 
            className="generated-image"
            style="cursor: pointer;"
            onClick=${() => window.open(image.imageUrl, '_blank')}
          />
        </div>

        <div className="generated-image-right">
          <${InfoField} 
            label="Workflow" 
            value=${image.workflow} 
            onCopy=${() => handleCopy(image.workflow, 'Workflow')}
          />
          
          <${InfoField} 
            label="Name" 
            value=${image.name} 
            onCopy=${() => handleCopy(image.name, 'Name')}
          />
          
          <${InfoField} 
            label="Tags" 
            value=${Array.isArray(image.tags) ? image.tags.join(', ') : image.tags} 
            isTextarea=${true}
            onCopy=${() => handleCopy(Array.isArray(image.tags) ? image.tags.join(', ') : image.tags, 'Tags')}
          />
          
          <${InfoField} 
            label="Prompt" 
            value=${image.prompt} 
            isTextarea=${true}
            onCopy=${() => handleCopy(image.prompt, 'Prompt')}
            onUse=${() => onUsePrompt && onUsePrompt(image.prompt)}
            useTitle="Use this prompt"
          />
          
          <${InfoField} 
            label="Description" 
            value=${image.description} 
            isTextarea=${true}
            onCopy=${() => handleCopy(image.description, 'Description')}
          />
          
          <${InfoField} 
            label="Seed" 
            value=${image.seed} 
            onCopy=${() => handleCopy(image.seed, 'Seed')}
            onUse=${() => onUseSeed && onUseSeed(image.seed)}
            useTitle="Use this seed"
          />
        </div>
      </div>

      <div className="image-action-container">
        <${Button} 
          className="image-select-btn"
          icon="check-circle"
          onClick=${() => onSelectAsInput && onSelectAsInput(image)}
          disabled=${!onSelectAsInput}
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

function InfoField({ label, value, isTextarea = false, onCopy, onUse, useTitle }) {
  const labelLower = label.toLowerCase();
  const fieldClass = labelLower === 'tags' ? 'info-tags-field' : `info-${labelLower}`;

  return html`
    <div className="info-section">
      <div className="info-header">
        <label className="info-label">${label}:</label>
        <div className="info-buttons">
          <button className="info-btn copy-btn" onClick=${onCopy} title="Copy ${label}">
            <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
          </button>
          ${onUse && html`
            <button className="info-btn use-btn" onClick=${onUse} title=${useTitle}>
              <box-icon name='up-arrow-circle' color='#ffffff' size='16px'></box-icon>
            </button>
          `}
          <!-- Edit button disabled/hidden for now as per V2 simplified implementation -->
          <button className="info-btn edit-btn" title="Edit" disabled>
            <box-icon name='pencil' color='#ffffff' size='16px'></box-icon>
          </button>
        </div>
      </div>
      ${isTextarea 
        ? html`<textarea className="info-field ${fieldClass}" readOnly value=${value || ''}></textarea>`
        : html`<input type="text" className="info-field ${fieldClass}" readOnly value=${value || ''} />`
      }
    </div>
  `;
}
