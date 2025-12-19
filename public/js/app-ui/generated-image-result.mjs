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
    <div className="generated-image-display" style="display: block;">
      <div className="image-container">
        <img 
          src=${image.imageUrl} 
          alt=${image.name || 'Generated Image'} 
          className="generated-image"
          style="cursor: pointer;"
          onClick=${() => window.open(image.imageUrl, '_blank')}
        />
      </div>

      <div className="image-controls">
        <div className="control-group">
          <${Button} 
            variant="success" 
            className="image-select-btn"
            onClick=${() => onSelectAsInput && onSelectAsInput(image)}
            disabled=${!onSelectAsInput}
          >
            Use as Input
          <//>
          <${Button} 
            variant="secondary"
            className="image-inpaint-btn" 
            onClick=${() => onInpaint && onInpaint(image)}
            disabled=${!image.uid || !onInpaint}
          >
            Inpaint
          <//>
          <${Button} 
            variant="danger" 
            className="image-delete-btn"
            onClick=${() => onDelete && onDelete(image)}
            disabled=${!image.uid || !onDelete}
          >
            Delete
          <//>
        </div>
      </div>

      <div className="image-info">
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
  `;
}

function InfoField({ label, value, isTextarea = false, onCopy, onUse, useTitle }) {
  return html`
    <div className="info-section">
      <label className="info-label">${label}</label>
      <div className="info-content">
        ${isTextarea 
          ? html`<textarea className="info-field info-${label.toLowerCase()}" readOnly value=${value || ''}></textarea>`
          : html`<input type="text" className="info-field info-${label.toLowerCase()}" readOnly value=${value || ''} />`
        }
        <div className="info-buttons">
          <${Button} variant="icon" className="copy-btn" onClick=${onCopy} title="Copy ${label}">
            <box-icon name='copy' color='#ffffff' size='16px'></box-icon>
          <//>
          ${onUse && html`
            <${Button} variant="icon" className="use-btn" onClick=${onUse} title=${useTitle}>
              <box-icon name='up-arrow-circle' color='#ffffff' size='16px'></box-icon>
            <//>
          `}
        </div>
      </div>
    </div>
  `;
}
