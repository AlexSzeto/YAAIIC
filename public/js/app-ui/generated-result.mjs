import { useState } from 'preact/hooks';
import { html, Component } from 'htm/preact';
import { Button } from '../custom-ui/button.mjs';
import { Tags } from '../custom-ui/tags.mjs';
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
  onRegenerate,
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
            onClick=${() => createImageModal(image.imageUrl, true)}
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
          
          <${TabbedInfoField}
            tabs=${[
              {
                id: 'tags',
                name: 'Tags',
                value: Array.isArray(image.tags) ? image.tags.join(', ') : image.tags,
                canEdit: true,
                onUse: null, // No use button for tags
                useTitle: ''
              },
              {
                id: 'prompt',
                name: 'Prompt',
                value: image.prompt,
                canEdit: true,
                onUse: () => onUsePrompt && onUsePrompt(image.prompt),
                useTitle: 'Use this prompt'
              },
              {
                id: 'description',
                name: 'Description',
                value: image.description,
                canEdit: true,
                onUse: () => onUseDescription && onUseDescription(image.description),
                useTitle: 'Use this description'
              },
              {
                id: 'summary',
                name: 'Summary',
                value: image.summary,
                canEdit: true,
                onUse: () => onUseDescription && onUseDescription(image.summary),
                useTitle: 'Use this summary'
              }
            ]}
            onCopy=${handleCopy}
            onEditStart=${startEditing}
            onSave=${handleSave}
            onCancel=${stopEditing}
            onRegenerate=${onRegenerate}
            editingField=${editingField}
            image=${image}
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
          variant="success"
          icon="check-circle"
          onClick=${() => onSelectAsInput && onSelectAsInput(image)}
          disabled=${!onSelectAsInput || isSelectDisabled}
          title="Use this image as input"
        >
          Select
        <//>
        <${Button} 
          variant="primary" 
          icon="image"
          onClick=${() => onInpaint && onInpaint(image)}
          disabled=${!image.uid || !onInpaint || /\.(webm|mp4|webp|gif)$/i.test(image.imageUrl || '')}
          title="Inpaint this image"
        >
          Inpaint
        <//Button>
        <${Button} 
          variant="danger"
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

/**
 * TabbedInfoField Component
 * Displays multiple fields (tags, prompt, description) in a tabbed interface
 * 
 * @param {Object} props
 * @param {Array} props.tabs - Array of tab configurations
 * @param {Function} props.onCopy - Copy handler
 * @param {Function} props.onEditStart - Edit start handler
 * @param {Function} props.onSave - Save handler
 * @param {Function} props.onCancel - Cancel handler
 * @param {Function} props.onRegenerate - Regenerate field handler
 * @param {string} props.editingField - Currently editing field
 * @param {Object} props.image - Image data object
 */
class TabbedInfoField extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTab: 'prompt',
      editValue: ''
    };
  }

  componentDidMount() {
    // Default to "prompt" tab
    this.setState({ selectedTab: 'prompt' });
  }

  componentDidUpdate(prevProps) {
    // Update editValue when editing starts
    if (this.props.editingField && !prevProps.editingField) {
      const activeTab = this.props.tabs.find(t => t.id === this.state.selectedTab);
      if (activeTab) {
        this.setState({ editValue: activeTab.value || '' });
      }
    }
  }

  handleTabSelect = (id) => {
    this.setState({ selectedTab: id });
  };

  handleEditClick = () => {
    const activeTab = this.props.tabs.find(t => t.id === this.state.selectedTab);
    if (activeTab && activeTab.canEdit) {
      this.setState({ editValue: activeTab.value || '' });
      this.props.onEditStart(activeTab.id);
    }
  };

  handleSaveClick = () => {
    const activeTab = this.props.tabs.find(t => t.id === this.state.selectedTab);
    if (activeTab) {
      this.props.onSave(activeTab.id, this.state.editValue);
    }
  };

  render() {
    const { tabs, onCopy, editingField, onCancel, onRegenerate, image } = this.props;
    const { selectedTab, editValue } = this.state;
    
    const activeTab = tabs.find(t => t.id === selectedTab);
    if (!activeTab) return null;

    const isEditing = editingField === activeTab.id;
    const tabItems = tabs.map(t => ({ id: t.id, name: t.name }));
    
    // Check if this is a video file
    const isVideo = image && /\.(webm|mp4|webp|gif)$/i.test(image.imageUrl || '');
    
    // Check if regenerate is available for this field (only for text fields, not videos)
    const canRegenerate = !isVideo && onRegenerate && (activeTab.id === 'tags' || activeTab.id === 'prompt' || activeTab.id === 'description' || activeTab.id === 'summary');

    return html`
      <div className="tabbed-info-section">
        <div className="tabbed-info-header">
          <${Tags}
            items=${tabItems}
            selected=${[selectedTab]}
            onSelect=${this.handleTabSelect}
          />
          <div className="info-buttons">
            ${!isEditing ? html`
              <${Button}
                variant="icon"
                icon="refresh-cw"
                onClick=${() => onRegenerate && onRegenerate(image.uid, activeTab.id)}
                title="Regenerate ${activeTab.name}"
                disabled=${!canRegenerate}
              />
              <${Button}
                variant="icon"
                icon="copy"
                onClick=${() => onCopy(activeTab.name, activeTab.value)}
                title="Copy ${activeTab.name}"
                disabled=${!onCopy || !activeTab.value}
              />
              <${Button}
                variant="icon"
                icon="up-arrow-circle"
                onClick=${activeTab.onUse}
                title=${activeTab.useTitle || `Use ${activeTab.name}`}
                disabled=${!activeTab.onUse}
              />
              <${Button}
                variant="icon"
                icon="pencil"
                onClick=${activeTab.canEdit ? this.handleEditClick : null}
                title="Edit"
                disabled=${!activeTab.canEdit}
              />
            ` : html`
              <${Button}
                variant="icon"
                icon="check"
                onClick=${this.handleSaveClick}
                title="Save"
                style=${{ backgroundColor: '#28a745', borderColor: '#28a745' }}
              />
              <${Button}
                variant="icon"
                icon="x"
                onClick=${onCancel}
                title="Cancel"
                style=${{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              />
            `}
          </div>
        </div>
        <textarea 
            className="info-field info-tabbed ${isEditing ? 'editing' : ''}" 
            readOnly=${!isEditing} 
            value=${isEditing ? editValue : (activeTab.value || '')}
            onInput=${(e) => this.setState({ editValue: e.target.value })}
        ></textarea>
      </div>
    `;
  }
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
            <${Button}
              variant="icon"
              icon="copy"
              onClick=${onCopy}
              title="Copy ${label}"
              disabled=${!onCopy}
            />
            <${Button}
              variant="icon"
              icon="up-arrow-circle"
              onClick=${onUse}
              title=${useTitle || `Use ${label}`}
              disabled=${!onUse}
            />
            <${Button}
              variant="icon"
              icon="pencil"
              onClick=${canEdit ? handleEditClick : null}
              title="Edit"
              disabled=${!canEdit}
            />
          ` : html`
            <${Button}
              variant="icon"
              icon="check"
              onClick=${handleSaveClick}
              title="Save"
              style=${{ backgroundColor: '#28a745', borderColor: '#28a745' }}
            />
            <${Button}
              variant="icon"
              icon="x"
              onClick=${onCancel}
              title="Cancel"
              style=${{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
            />
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
