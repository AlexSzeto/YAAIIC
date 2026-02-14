import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Textarea } from '../custom-ui/io/textarea.mjs';
import { Input } from '../custom-ui/io/input.mjs';
import { Button } from '../custom-ui/io/button.mjs';
import { SeedControl } from './seed-control.mjs';
import { ImageSelect } from '../custom-ui/media/image-select.mjs';
import { AudioSelect } from '../custom-ui/media/audio-select.mjs';
import { createExtraInputsRenderer } from './extra-inputs-renderer.mjs';
import { HorizontalLayout, VerticalLayout } from '../custom-ui/themed-base.mjs';
import { createTagSelectionHandler } from './tag-insertion-util.mjs';
import { TagSelectorPanel } from './tag-selector-panel.mjs';
import { suppressContextMenu } from '../custom-ui/util.mjs';
import { isTagDefinitionsLoaded } from './tag-data.mjs';

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
    <${VerticalLayout}>
      
      <${HorizontalLayout}>
        <${SeedControl}
          seed=${formState.seed || -1}
          setSeed=${(newSeed) => onFieldChange('seed', newSeed)}
          locked=${formState.seedLocked || false}
          setLocked=${(locked) => onFieldChange('seedLocked', locked)}
          disabled=${isGenerating}
        />
      </${HorizontalLayout}>

      <!-- Row 1: Name, Seed, Lock -->
      <${HorizontalLayout}>
        <${Input}
          label="Name"
          type="text"
          placeholder="Enter name"
          value=${formState.name || ''}
          onChange=${handleChange('name')}
          disabled=${isGenerating}
        />

        ${workflow?.extraInputs ? html`
          ${renderExtraInputs(workflow.extraInputs, 'standard')}
      ` : null}
      </${HorizontalLayout}>

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
        <${HorizontalLayout}>
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
        </${HorizontalLayout}>
      `}

      <!-- Row 3.5: Audio Upload -->
      ${workflow?.inputAudios > 0 && html`
        <${HorizontalLayout}>
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
        </${HorizontalLayout}>
      `}

      <!-- Row 4: Action Buttons -->
      <${HorizontalLayout} gap="small">
        <${Button} 
          variant="primary"
          icon="play"
          onClick=${onGenerate}
          loading=${isGenerating}
          disabled=${isGenerateDisabled}
        >
          ${isGenerating ? 'Generating...' : 'Generate'}
        </${Button}>



        <${Button} 
          variant="primary"
          icon="upload"
          title="Upload Media"
          onClick=${onUploadClick || (() => document.getElementById('upload-file-input')?.click())}
          disabled=${isGenerating}
        >
          Upload
        </${Button}>
      </${HorizontalLayout}>

      <!-- Tag Selector Panel -->
      <${TagSelectorPanel}
        isOpen=${showTagPanel}
        onSelect=${handleTagSelect}
        onClose=${handleCloseTagPanel}
      />

    </${VerticalLayout}>
  `;
}
