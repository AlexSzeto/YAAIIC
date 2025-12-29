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
 * Normalize frame count to (n * 4) + 1 sequence
 * @param {number|string} inputValue - The input frame count
 * @returns {number} Normalized frame count following (n * 4) + 1 pattern
 */
function normalizeFrameCount(inputValue) {
  const num = parseInt(inputValue, 10);
  if (isNaN(num) || num < 1) return 1;
  // Calculate n where (n * 4) + 1 >= num
  const n = Math.ceil((num - 1) / 4);
  return (n * 4) + 1;
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
    framerate: 20
  });
  
  const [generatedImage, setGeneratedImage] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenerateTaskId, setRegenerateTaskId] = useState(null);

  // Phase 4: History & Gallery State
  const [history, setHistory] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Input images for img2img workflows (array of {blob, url, description})
  const [inputImages, setInputImages] = useState([]);
  
  // All available workflows (for lookup)
  const [workflows, setWorkflows] = useState([]);
  
  // Gallery selection state
  const [gallerySelectionMode, setGallerySelectionMode] = useState({ active: false, index: -1 });

  // Initialize autocomplete & Load Initial History
  useEffect(() => {
    async function init() {
      try {
        await loadTags();
        setTimeout(() => {
             initAutoComplete();
             console.log('Autocomplete initialized in App V2');
        }, 100);

        // Load workflows for lookup
        const workflowData = await fetchJson('/workflows');
        if (Array.isArray(workflowData)) {
          const imageVideoWorkflows = workflowData.filter(
            w => w.type === 'image' || w.type === 'video'
          );
          setWorkflows(imageVideoWorkflows);
        }

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
    setGallerySelectionMode({ active: true, index: targetIndex });
    setIsGalleryOpen(true);
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
    
    // Validate that "detect" orientation workflows have input images
    if (workflow.orientation === 'detect') {
      const hasInputImages = inputImages.some(img => img && img.blob);
      if (!hasInputImages) {
        toast.error('This workflow requires input images to detect orientation');
        return;
      }
    }

    try {
      setIsGenerating(true);
      
      // Determine orientation - default to "detect" if undefined
      let orientation = workflow.orientation || 'detect';
      
      // If workflow has orientation: "detect", calculate from first input image
      if (orientation === 'detect' && inputImages.length > 0 && inputImages[0]) {
        const firstImage = inputImages[0];
        
        if (firstImage.blob) {
          // Load image to get dimensions
          const img = new Image();
          const imageUrl = URL.createObjectURL(firstImage.blob);
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });
          URL.revokeObjectURL(imageUrl);
          
          // Determine orientation: portrait if height > width, landscape otherwise
          orientation = img.height > img.width ? 'portrait' : 'landscape';
          console.log(`Detected orientation: ${orientation} (${img.width}x${img.height})`);
        }
      }
      
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
          formData.append('frames', normalizeFrameCount(formState.length));
          formData.append('framerate', formState.framerate);
          formData.append('orientation', orientation);
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
        
        response = await fetchJson('/generate', {
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
          length: normalizeFrameCount(formState.length),
          framerate: formState.framerate,
          orientation: orientation
        };

        response = await fetchJson('/generate', {
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
    setTaskId(null);
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
    setTaskId(null);
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
     // Look up full workflow object by name
     const wf = workflows.find(w => w.name === wfName);
     if (wf) {
       setWorkflow(wf);
       toast.show(`Workflow set to ${wfName}`);
     } else {
       toast.error(`Workflow '${wfName}' not found`);
     }
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
      const newHistory = history.filter(item => item.uid !== image.uid);
      setHistory(newHistory);
      
      // If deleted image was current, pick next available from history
      if (generatedImage && generatedImage.uid === image.uid) {
        if (newHistory.length > 0) {
          // Find original index of deleted item
          const deletedIndex = history.findIndex(item => item.uid === image.uid);
          // Pick next item, or previous if deleted was last
          const nextIndex = Math.min(deletedIndex, newHistory.length - 1);
          setGeneratedImage(newHistory[nextIndex]);
        } else {
          setGeneratedImage(null);
        }
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

  const handleRegenerate = async (uid, field) => {
    try {
      const response = await fetchJson('/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, fields: [field] })
      });

      if (!response.taskId) {
        throw new Error('No task ID returned from server');
      }

      // Set regeneration task ID to trigger progress banner
      setRegenerateTaskId(response.taskId);

    } catch (err) {
      console.error('Regenerate failed:', err);
      toast.error(err.message || 'Failed to start regeneration');
    }
  };

  const handleRegenerateComplete = async (data) => {
    console.log('Regenerate complete:', data);
    setRegenerateTaskId(null);
    
    if (data.imageData) {
      // Update the generated image display with complete data
      setGeneratedImage(data.imageData);
      
      // Update history item by uid
      setHistory(prev => prev.map(item => 
        item.uid === data.imageData.uid ? data.imageData : item
      ));
      
      toast.success('Regeneration complete');
    }
  };

  const handleRegenerateError = (data) => {
    console.error('Regenerate error:', data);
    setRegenerateTaskId(null);
    toast.error(data.error?.message || 'Regeneration failed');
  };

  // Gallery handlers
  const handleGallerySelect = async (item) => {
     if (gallerySelectionMode.active) {
         // Selection mode: Use image as input
         const imageUrl = item.imageUrl || item.url;
         if (imageUrl) {
             try {
                 // Fetch the image as a blob so it can be sent to the server
                 const response = await fetch(imageUrl);
                 const blob = await response.blob();
                 
                 setInputImages(prev => {
                     const newImages = [...prev];
                     newImages[gallerySelectionMode.index] = { 
                         blob, 
                         url: imageUrl, 
                         description: item.description || null 
                     };
                     return newImages;
                 });
                 
                 toast.success('Image selected from gallery');
             } catch (err) {
                 console.error('Failed to fetch image from gallery:', err);
                 toast.error('Failed to select image from gallery');
             }
         }
         setIsGalleryOpen(false);
         setGallerySelectionMode({ active: false, index: -1 });
     } else {
         // View mode: View generated result
         setGeneratedImage(item);
         // Also ensure it's in history (if not already)
         if (!history.find(h => h.uid === item.uid)) {
             setHistory(prev => [item, ...prev]);
         }
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
      
      const result = await fetchJson('/upload/image', {
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
        <${ProgressBanner} 
          key=${taskId}
          taskId=${taskId}
          sseManager=${sseManager}
          onComplete=${handleGenerationComplete}
          onError=${handleGenerationError}
        />
      ` : null}
      
      ${regenerateTaskId ? html`
        <${ProgressBanner} 
          key=${regenerateTaskId}
          taskId=${regenerateTaskId}
          sseManager=${sseManager}
          onComplete=${handleRegenerateComplete}
          onError=${handleRegenerateError}
          defaultTitle="Regenerating..."
        />
      ` : null}
      
      <div className="workflow-controls">
        <${WorkflowSelector}
          value=${workflow}
          onChange=${handleWorkflowChange}
          disabled=${isGenerating}
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
        onRegenerate=${handleRegenerate}
        onSelectAsInput=${handleSelectAsInput}
        isSelectDisabled=${(() => {
          // Disable if no workflow or workflow doesn't need images
          if (!workflow || !workflow.inputImages || workflow.inputImages <= 0) return true;
          // Disable if the image is a video file
          const imageUrl = generatedImage?.imageUrl || '';
          const isVideo = /\.(webm|mp4|webp|gif)$/i.test(imageUrl);
          if (isVideo) return true;
          // Disable if all slots are filled
          const filledCount = inputImages.filter(img => img && (img.blob || img.url)).length;
          if (filledCount >= workflow.inputImages) return true;
          return false;
        })()}
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
        onClose=${() => {
            setIsGalleryOpen(false);
            setGallerySelectionMode({ active: false, index: -1 });
        }}
        queryPath="/image-data"
        previewFactory=${createGalleryPreview}
        onSelect=${handleGallerySelect}
        onLoad=${(items) => {
          if (items && items.length > 0) {
             // Replace session history with loaded items
             setHistory(items);
             setGeneratedImage(items[0]);
          }
        }}
        selectionMode=${gallerySelectionMode.active}
        fileTypeFilter=${gallerySelectionMode.active ? 'image' : null}
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
