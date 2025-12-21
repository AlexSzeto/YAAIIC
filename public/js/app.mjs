// Main application entry point for V2
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { ToastProvider, useToast } from './custom-ui/toast.mjs';
import { Modal } from './custom-ui/modal.mjs';
import { WorkflowSelector } from './app-ui/workflow-selector.mjs';
import { GenerationForm } from './app-ui/generation-form.mjs';
import { GeneratedResult } from './app-ui/generated-result.mjs';

import { ProgressBanner } from './custom-ui/progress-banner.mjs';
import { sseManager } from './sse-manager.mjs';
import { fetchJson } from './util.mjs';
import { initAutoComplete } from './autocomplete-setup.mjs';
import { loadTags } from './tags.mjs';

import { Gallery } from './custom-ui/gallery.mjs';
import { ImageCarousel } from './custom-ui/image-carousel.mjs';
import { createGalleryPreview } from './gallery-preview.mjs';
import { Button } from './custom-ui/button.mjs';

/**
 * Helper function to generate random seed
 */
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295); // Max 32-bit unsigned integer
}

/**
 * Main App Component
 */
function App() {
  const toast = useToast();
  
  // State management
  const [workflow, setWorkflow] = useState(null);
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    seed: generateRandomSeed(),
    seedLocked: false,
    // Video-specific fields
    length: 25,
    framerate: 20,
    orientation: 'portrait'
  });
  
  const [generatedImage, setGeneratedImage] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Phase 4: History & Gallery State
  const [history, setHistory] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Input images for img2img workflows (array of {blob, url, description})
  const [inputImages, setInputImages] = useState([]);

  // Initialize autocomplete & Load Initial History
  useEffect(() => {
    async function init() {
      try {
        await loadTags();
        setTimeout(() => {
             initAutoComplete();
             console.log('Autocomplete initialized in App V2');
        }, 100);

        // Load recent history
        const recent = await fetchJson('/image-data?limit=10');
        if (Array.isArray(recent)) {
          setHistory(recent);
          // Optionally set the first image as current
          if (recent.length > 0 && !generatedImage) setGeneratedImage(recent[0]);
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
      }
    }
    init();
  }, []);

  // Handle field changes
  const handleFieldChange = (fieldName, value) => {
    setFormState(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // Handle workflow change
  const handleWorkflowChange = (newWorkflow) => {
    setWorkflow(newWorkflow);
    // Reset input images when workflow changes
    setInputImages([]);
  };
  
  // Handle image change for a specific slot
  const handleImageChange = (index, fileOrUrl) => {
    setInputImages(prev => {
      const newImages = [...prev];
      if (fileOrUrl === null) {
        // Clear the slot
        newImages[index] = null;
      } else if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
        // It's a file/blob - create preview URL
        const url = URL.createObjectURL(fileOrUrl);
        newImages[index] = { blob: fileOrUrl, url };
      } else if (typeof fileOrUrl === 'string') {
        // It's a URL
        newImages[index] = { url: fileOrUrl };
      }
      return newImages;
    });
  };
  
  // Handle gallery selection for a specific image slot
  const handleSelectFromGallery = (targetIndex) => {
    // Store which slot we're targeting, then open gallery in selection mode
    // For now, just open the gallery. The selection handling will be wired later.
    setIsGalleryOpen(true);
    // TODO: Pass targetIndex to gallery so it knows which slot to fill
  };
  
  // Handle "Select as Input" from generated result or gallery
  const handleSelectAsInput = async (imageData) => {
    // Find first empty slot
    const requiredSlots = workflow?.inputImages || 0;
    let targetIndex = -1;
    
    for (let i = 0; i < requiredSlots; i++) {
      if (!inputImages[i]) {
        targetIndex = i;
        break;
      }
    }
    
    if (targetIndex === -1) {
      toast.error('All input image slots are filled');
      return;
    }
    
    try {
      // Fetch the image as a blob if we have a URL
      const imageUrl = imageData.imageUrl || imageData.url;
      if (!imageUrl) {
        toast.error('No image URL available');
        return;
      }
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      setInputImages(prev => {
        const newImages = [...prev];
        newImages[targetIndex] = { 
          blob, 
          url: imageUrl, 
          description: imageData.description || null 
        };
        return newImages;
      });
      
      toast.success('Image selected as input');
    } catch (err) {
      console.error('Failed to select image as input:', err);
      toast.error('Failed to select image as input');
    }
  };
  
  // Handle Generate
  const handleGenerate = async () => {
    if (!workflow) {
      toast.error('Please select a workflow');
      return;
    }
    
    // Basic validation
    if (!workflow.optionalPrompt && !formState.description.trim()) {
      toast.error('Please enter a description/prompt');
      return;
    }
    
    if (workflow.nameRequired && !formState.name.trim()) {
      toast.error('Please enter a name');
      return;
    }
    
    // Validate required images
    if (workflow.inputImages && workflow.inputImages > 0) {
      const uploadedCount = inputImages.filter(img => img && (img.blob || img.url)).length;
      if (uploadedCount < workflow.inputImages) {
        toast.error(`Please select ${workflow.inputImages} input image(s)`);
        return;
      }
    }

    try {
      setIsGenerating(true);
      
      // Check if we have images to send
      const hasImages = inputImages.some(img => img && img.blob);
      
      let response;
      
      if (hasImages) {
        // Build multipart form data with uploaded images
        const formData = new FormData();
        formData.append('prompt', formState.description);
        formData.append('workflow', workflow.name);
        formData.append('seed', formState.seed);
        
        if (formState.name.trim()) {
          formData.append('name', formState.name.trim());
        }
        
        // Video params
        if (workflow.type === 'video') {
          formData.append('frames', formState.length);
          formData.append('framerate', formState.framerate);
          formData.append('orientation', formState.orientation);
        }
        
        // Append images
        inputImages.forEach((img, index) => {
          if (img && img.blob) {
            formData.append(`image_${index}`, img.blob, `image_${index}.png`);
            if (img.description) {
              formData.append(`image_${index}_description`, img.description);
            }
          }
        });
        
        response = await fetchJson('/generate/image', {
          method: 'POST',
          body: formData
        });
      } else {
        // No images - use JSON
        const requestBody = {
          workflow: workflow.name,
          name: formState.name,
          description: formState.description,
          prompt: formState.description,
          seed: formState.seed,
          length: formState.length,
          framerate: formState.framerate,
          orientation: formState.orientation
        };

        response = await fetchJson('/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      }
      
      if (response.taskId) {
        setTaskId(response.taskId);
        toast.show('Generation started...', 'info');
      } else {
        throw new Error('No taskId returned');
      }
      
    } catch (err) {
      console.error('Generation failed:', err);
      toast.error(err.message || 'Failed to start generation');
      setIsGenerating(false);
    }
  };
  
  const handleGenerationComplete = async (data) => {
    setIsGenerating(false);
    console.log('Generation complete:', data);
    
    if (data.result && data.result.uid) {
      try {
        const img = await fetchJson(`/image-data/${data.result.uid}`);
        setGeneratedImage(img);
        
        // Add to history
        setHistory(prev => [img, ...prev]);
        
        toast.success(`Generated: ${img.name || 'Image'}`);
        
        if (!formState.seedLocked) {
           handleFieldChange('seed', generateRandomSeed());
        }
      } catch (err) {
        console.error('Failed to load result image:', err);
        toast.error('Failed to load generated image');
      }
    }
  };
  
  const handleGenerationError = (data) => {
    setIsGenerating(false);
    console.error('Generation error:', data);
  };
  
  // Handlers for Generated Result
  const handleUseSeed = (seed) => {
    setFormState(prev => ({ ...prev, seed: String(seed), seedLocked: true }));
    toast.show('Seed copied and locked');
  };
  
  const handleUsePrompt = (prompt) => {
    setFormState(prev => ({ ...prev, description: prompt }));
    toast.show('Prompt copied');
  };

  const handleUseWorkflow = (wfName) => {
     setWorkflow(wfName);
     toast.show(`Workflow set to ${wfName}`);
  };

  const handleUseName = (name) => {
    setFormState(prev => ({ ...prev, name: name }));
    toast.show('Name copied');
  };

  const handleUseDescription = (desc) => {
    setFormState(prev => ({ ...prev, description: desc }));
    toast.show('Description copied');
  };
  
  // Delete confirmation state
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, image: null });

  const handleDeleteImage = (image) => {
    setDeleteModalState({ isOpen: true, image });
  };

  const handleConfirmDelete = async () => {
    const image = deleteModalState.image;
    if (!image) return;

    try {
      await fetchJson('/image-data/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: [image.uid] })
      });
      
      // Remove from history
      setHistory(prev => prev.filter(item => item.uid !== image.uid));
      
      // If deleted image was current, clear it or pick next
      if (generatedImage && generatedImage.uid === image.uid) {
        setGeneratedImage(null);
      }

      toast.success('Image deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete image');
    } finally {
      setDeleteModalState({ isOpen: false, image: null });
    }
  };
  
  const handleInpaint = (image) => {
    if (image.uid) window.location.href = `inpaint.html?uid=${image.uid}`;
  };

  const handleEdit = async (uid, field, value) => {
    try {
      let valueToSend = value;
      if (field === 'tags') {
         if (typeof value === 'string') {
             valueToSend = value.split(',').map(t => t.trim()).filter(Boolean);
         } else if (!Array.isArray(value)) {
             valueToSend = [];
         }
      }

      const response = await fetchJson('/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...generatedImage, [field]: valueToSend })
      });

      if (response.success && response.data) {
        setGeneratedImage(response.data);
        
        // Update history item
        setHistory(prev => prev.map(item => item.uid === response.data.uid ? response.data : item));
        
        toast.success(`${field} updated`);
      } else {
        throw new Error('Failed to update image');
      }
    } catch (err) {
      console.error('Edit failed:', err);
      toast.error(err.message || 'Failed to save changes');
    }
  };

  // Gallery handlers
  const handleGallerySelect = async (item) => {
     setGeneratedImage(item);
     // Also ensure it's in history (if not already)
     if (!history.find(h => h.uid === item.uid)) {
         setHistory(prev => [item, ...prev]);
     }
  };

  // Carousel handlers
  const handleCarouselSelect = (item) => {
    setGeneratedImage(item);
  };

  // Upload handler
  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const result = await fetchJson('/api/upload-image', {
        method: 'POST',
        body: formData
      });
      
      if (result.taskId) {
         setTaskId(result.taskId);
         toast.show('Uploading...', 'info');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error(err.message || 'Upload failed');
    }
    
    // Reset input
    e.target.value = '';
  };

  return html`
    <div className="app-container">
      <div className="app-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h1>YAAIIG <small style="font-size: 0.5em; opacity: 0.6;">V2</small></h1>
        <${Button} 
          id="gallery-btn"
          onClick=${() => setIsGalleryOpen(true)}
          icon="images"
        >
          Gallery
        <//>
      </div>
      
      ${taskId ? html`
        <div id="progress-banner-container">
          <${ProgressBanner} 
            key=${taskId}
            taskId=${taskId}
            sseManager=${sseManager}
            onComplete=${handleGenerationComplete}
            onError=${handleGenerationError}
          />
        </div>
      ` : null}
      
      <div className="workflow-controls">
        <${WorkflowSelector}
          value=${workflow}
          onChange=${handleWorkflowChange}
        />
        
        <${GenerationForm}
          workflow=${workflow}
          formState=${formState}
          onFieldChange=${handleFieldChange}
          isGenerating=${isGenerating}
          onGenerate=${handleGenerate}
          onOpenGallery=${() => setIsGalleryOpen(true)}
          onUploadClick=${() => document.getElementById('upload-file-input')?.click()}
          inputImages=${inputImages}
          onImageChange=${handleImageChange}
          onSelectFromGallery=${handleSelectFromGallery}
        />
        <!-- Note: Passed onUploadClick logic to decouple, though implementation of upload button in Form relies on ID or prop -->
      </div>
      
      <${GeneratedResult} 
        image=${generatedImage}
        onUseSeed=${handleUseSeed}
        onUsePrompt=${handleUsePrompt}
        onUseWorkflow=${handleUseWorkflow}
        onUseName=${handleUseName}
        onUseDescription=${handleUseDescription}
        onDelete=${handleDeleteImage}
        onInpaint=${handleInpaint}
        onEdit=${handleEdit}
        onSelectAsInput=${handleSelectAsInput}
      />

      <!-- Carousel for History -->
      ${history.length > 0 && html`
        <div className="history-carousel-container" style="margin-top: 20px;">
          <h3 style="margin-bottom: 10px; font-size: 1rem; color: var(--text-secondary);">Session History</h3>
          <${ImageCarousel} 
            items=${history} 
            selectedItem=${generatedImage}
            onSelect=${handleCarouselSelect}
          />
        </div>
      `}

      <!-- Gallery Modal -->
      <${Gallery} 
        isOpen=${isGalleryOpen}
        onClose=${() => setIsGalleryOpen(false)}
        queryPath="/image-data"
        previewFactory=${createGalleryPreview}
        onSelect=${handleGallerySelect}
        onLoad=${(items) => {
          if (items && items.length > 0) {
             handleGallerySelect(items[0]);
          }
        }}
        selectionMode=${false}
        onSelectAsInput=${handleSelectAsInput}
      />
      
      <input 
        type="file" 
        id="upload-file-input" 
        style="display: none" 
        accept="image/*"
        onChange=${handleUploadFile}
      />
      
      <!-- Delete Confirmation Modal -->
      <${Modal}
        isOpen=${deleteModalState.isOpen}
        onClose=${() => setDeleteModalState({ isOpen: false, image: null })}
        title="Confirm Deletion"
        size="small"
        footer=${html`
          <${Button} 
            variant="secondary" 
            onClick=${() => setDeleteModalState({ isOpen: false, image: null })}
          >
            Cancel
          <//>
          <${Button} 
            variant="danger" 
            onClick=${handleConfirmDelete}
            icon="trash"
          >
            Delete
          <//>
        `}
      >
        <p>Are you sure you want to delete <strong>"${deleteModalState.image?.name || 'this image'}"</strong>?</p>
        <p style="font-size: 0.9em; color: var(--text-secondary); margin-top: 10px;">This action cannot be undone.</p>
      <//>
    </div>
  `;
}

// Mount the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${ToastProvider}>
        <${App} />
      <//>
    `, root);
    console.log('App V2 mounted successfully');
  } else {
    console.error('Root element #app not found');
  }
});
