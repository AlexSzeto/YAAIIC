import { useState } from 'preact/hooks';
import { html, Component } from 'htm/preact';
import { styled } from '../custom-ui/goober-setup.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { ButtonGroup } from '../custom-ui/nav/button-group.mjs';
import { AudioPlayer } from '../custom-ui/media/audio-player.mjs';
import { sendToClipboard } from '../custom-ui/util.mjs';
import { createImageModal } from '../custom-ui/overlays/modal.mjs';
import { showListSelect } from '../custom-ui/overlays/list-select.mjs';
import { useToast } from '../custom-ui/msg/toast.mjs';
import { currentTheme } from '../custom-ui/theme.mjs';

// Styled components
const Container = styled('div')`
  padding: 20px;
  background-color: ${() => currentTheme.value.colors.background.secondary};
  border: 1px solid ${() => currentTheme.value.colors.border.secondary};
  border-radius: 8px;
`;

const Title = styled('h3')`
  color: ${() => currentTheme.value.colors.text.primary};
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
`;

const Content = styled('div')`
  display: flex;
  gap: 20px;
  align-items: flex-start;
`;

const LeftColumn = styled('div')`
  flex: 0 0 auto;
  max-width: 50%;
  position: relative;
`;

const GeneratedImage = styled('img')`
  max-width: 100%;
  height: auto;
  max-height: 70vh;
  border-radius: 4px;
  display: block;
  cursor: pointer;
`;

const RightColumn = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const ActionContainer = styled('div')`
  margin-top: 15px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 15px;
`;

// InfoSection styled components
const InfoSection = styled('div')`
  display: flex;
  flex-direction: column;
`;

const InfoHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  gap: 10px;
`;

const InfoLabel = styled('label')`
  font-weight: ${() => currentTheme.value.typography.fontWeight.medium};
  color: ${() => currentTheme.value.colors.text.primary};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
`;

const InfoButtons = styled('div')`
  display: flex;
  gap: 5px;
`;

const InfoInput = styled('input')`
  width: 100%;
  padding: 8px 10px;
  border: 2px solid ${() => currentTheme.value.colors.border.primary};
  border-radius: 4px;
  background-color: ${() => currentTheme.value.colors.background.secondary};
  color: ${() => currentTheme.value.colors.text.primary};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  
  ${props => props.isEditing ? `
    border-color: ${currentTheme.value.colors.primary.background};
    background-color: ${currentTheme.value.colors.background.primary};
    box-shadow: 0 0 0 2px ${currentTheme.value.colors.primary.focus};
  ` : ''}

  &:focus {
    outline: none;
    border-color: ${() => currentTheme.value.colors.primary.background};
    box-shadow: 0 0 0 2px ${() => currentTheme.value.colors.primary.focus};
  }
`;

const InfoTextarea = styled('textarea')`
  width: 100%;
  min-height: 80px;
  padding: 8px 10px;
  border: 2px solid ${() => currentTheme.value.colors.border.primary};
  border-radius: 4px;
  background-color: ${() => currentTheme.value.colors.background.secondary};
  color: ${() => currentTheme.value.colors.text.primary};
  font-family: ${() => currentTheme.value.typography.fontFamily};
  font-size: ${() => currentTheme.value.typography.fontSize.medium};
  resize: vertical;
  
  ${props => props.isEditing ? `
    border-color: ${currentTheme.value.colors.primary.background};
    background-color: ${currentTheme.value.colors.background.primary};
    box-shadow: 0 0 0 2px ${currentTheme.value.colors.primary.focus};
  ` : ''}

  &:focus {
    outline: none;
    border-color: ${() => currentTheme.value.colors.primary.background};
    box-shadow: 0 0 0 2px ${() => currentTheme.value.colors.primary.focus};
  }
`;

// TabbedInfoSection styled components
const TabbedInfoSection = styled('div')`
  display: flex;
  flex-direction: column;
`;

const TabbedInfoHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  gap: 10px;
`;

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
  isSelectDisabled = false,
  isInpaintDisabled = false
}) {
  if (!image) return null;

  // Track which field is currently being edited
  // { field: string | null }
  const [editingField, setEditingField] = useState(null);
  const toast = useToast();
  
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

  const handleExport = async () => {
    try {
      // Determine media type from the image data
      const mediaType = image.type || (image.audioUrl ? 'audio' : 'image');
      
      // Fetch exports filtered by media type
      const response = await fetch(`/exports?type=${mediaType}`);
      if (!response.ok) {
        throw new Error('Failed to fetch exports');
      }
      const exports = await response.json();
      
      if (exports.length === 0) {
        toast.info('No export destinations configured for this media type');
        return;
      }
      
      // Show list select modal with exports
      showListSelect({
        title: 'Export To',
        items: exports.map(exp => ({
          id: exp.id,
          label: exp.name
        })),
        itemIcon: 'export',
        showActions: false,
        showActionButton: false,
        onSelectItem: async (item) => {
          try {
            // Trigger export
            const exportResponse = await fetch('/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                exportId: item.id,
                mediaId: image.uid
              })
            });
            
            const result = await exportResponse.json();
            
            if (result.success) {
              toast.success(`Exported to ${item.label}`);
            } else {
              toast.error(`Export failed: ${result.error}`);
            }
          } catch (error) {
            toast.error(`Export error: ${error.message}`);
          }
        }
      });
      
    } catch (error) {
      toast.error(`Failed to load exports: ${error.message}`);
    }
  };

  return html`
    <${Container}>
      <${Title}>Generated Result<//>
      
      <${Content}>
        <${LeftColumn}>
          <${GeneratedImage}
            src=${image.imageUrl} 
            alt=${image.name || 'Generated Image'} 
            onClick=${() => createImageModal(image.imageUrl, true)}
          />
          ${image.audioUrl ? html`
            <${AudioPlayer} audioUrl=${image.audioUrl} />
          ` : null}
        <//>

        <${RightColumn}>
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
                onUse: null,
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
        <//>
      <//>

      <${ActionContainer}>
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
          disabled=${isInpaintDisabled}
          title="Inpaint this image"
        >
          Inpaint
        <//>
        <${Button}
          variant="primary"
          icon="export"
          onClick=${handleExport}
          disabled=${!image.uid}
          title="Export this media"
        >
          Export
        <//>
        <${Button} 
          variant="danger"
          icon="trash"
          onClick=${() => onDelete && onDelete(image)}
          disabled=${!image.uid || !onDelete}
          title="Delete this image"
        >
          Delete
        <//>
      <//>
    <//>
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
    
    // Check if regenerate is available for this field (only for text fields, not videos, and not prompt)
    const canRegenerate = !isVideo && onRegenerate && (activeTab.id === 'tags' || activeTab.id === 'description' || activeTab.id === 'summary');

    return html`
      <${TabbedInfoSection}>
        <${TabbedInfoHeader}>
          <${ButtonGroup}
            items=${tabItems}
            selected=${[selectedTab]}
            onSelect=${this.handleTabSelect}
          />
          <${InfoButtons}>
            ${!isEditing ? html`
              <${Button}
                variant="small-icon"
                icon="revision"
                onClick=${() => onRegenerate && onRegenerate(image.uid, activeTab.id)}
                title="Regenerate ${activeTab.name}"
                disabled=${!canRegenerate}
              />
              <${Button}
                variant="small-icon"
                icon="copy"
                onClick=${() => onCopy(activeTab.value, activeTab.name)}
                title="Copy ${activeTab.name}"
                disabled=${!onCopy || !activeTab.value}
              />
              <${Button}
                variant="small-icon"
                icon="up-arrow-circle"
                onClick=${activeTab.onUse}
                title=${activeTab.useTitle || `Use ${activeTab.name}`}
                disabled=${!activeTab.onUse}
              />
              <${Button}
                variant="small-icon"
                icon="pencil"
                onClick=${activeTab.canEdit ? this.handleEditClick : null}
                title="Edit"
                disabled=${!activeTab.canEdit}
              />
            ` : html`
              <${Button}
                variant="small-icon"
                color="success"
                icon="check"
                onClick=${this.handleSaveClick}
                title="Save"
              />
              <${Button}
                variant="small-icon"
                color="danger"
                icon="x"
                onClick=${onCancel}
                title="Cancel"
              />
            `}
          <//>
        <//>
        <${InfoTextarea}
            isEditing=${isEditing}
            readOnly=${!isEditing} 
            value=${isEditing ? editValue : (activeTab.value || '')}
            onInput=${(e) => this.setState({ editValue: e.target.value })}
        />
      <//>
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

  return html`
    <${InfoSection}>
      <${InfoHeader}>
        <${InfoLabel}>${label}:<//>
        <${InfoButtons}>
          ${!isEditing ? html`
            <${Button}
              variant="small-icon"
              icon="copy"
              onClick=${onCopy}
              title="Copy ${label}"
              disabled=${!onCopy}
            />
            <${Button}
              variant="small-icon"
              icon="up-arrow-circle"
              onClick=${onUse}
              title=${useTitle || `Use ${label}`}
              disabled=${!onUse}
            />
            <${Button}
              variant="small-icon"
              icon="pencil"
              onClick=${canEdit ? handleEditClick : null}
              title="Edit"
              disabled=${!canEdit}
            />
          ` : html`
            <${Button}
              variant="small-icon"
              color="success"
              icon="check"
              onClick=${handleSaveClick}
              title="Save"
            />
            <${Button}
              variant="small-icon"
              color="danger"
              icon="x"
              onClick=${onCancel}
              title="Cancel"
            />
          `}
        <//>
      <//>
      ${isTextarea 
        ? html`
            <${InfoTextarea}
                isEditing=${isEditing}
                readOnly=${!isEditing} 
                value=${isEditing ? editValue : (value || '')}
                onInput=${(e) => setEditValue(e.target.value)}
            />`
        : html`
            <${InfoInput}
                type="text" 
                isEditing=${isEditing}
                readOnly=${!isEditing} 
                value=${isEditing ? editValue : (value || '')}
                onInput=${(e) => setEditValue(e.target.value)}
            />`
      }
    <//>
  `;
}
