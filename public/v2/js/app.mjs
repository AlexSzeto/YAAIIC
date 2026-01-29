// Main application entry point for V2
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from 'goober';
import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider, useToast } from './custom-ui/msg/toast.mjs';
import { Modal } from './custom-ui/overlays/modal.mjs';
import { Button } from './custom-ui/io/button.mjs';
import { ProgressBanner } from './custom-ui/msg/progress-banner.mjs';
import { getThemeValue } from './custom-ui/theme.mjs';

import { WorkflowSelector } from './app-ui/workflow-selector.mjs';
import { GenerationForm } from './app-ui/generation-form.mjs';
import { GeneratedResult } from './app-ui/generated-result.mjs';
import { Gallery } from './app-ui/gallery.mjs';
import { NavigatorComponent } from './custom-ui/nav/navigator.mjs';
import { showFolderSelect } from './app-ui/folder-select.mjs';

import { sseManager } from './app-ui/sse-manager.mjs';
import { fetchJson, extractNameFromFilename } from './util.mjs';
import { initAutoComplete } from './app-ui/autocomplete-setup.mjs';
import { loadTags } from './app-ui/tags.mjs';
import { createGalleryPreview } from './app-ui/gallery-preview.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const AppContainer = styled('div')`
  /* Container styles already handled by Page component */
`;

const AppHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${getThemeValue('spacing.large.gap')};
`;

const HeaderTitle = styled('h1')`
  color: ${getThemeValue('colors.text.primary')};
  margin: 0;
  
  small {
    font-size: 0.5em;
    opacity: 0.6;
  }
`;

const HeaderButtons = styled('div')`
  display: flex;
  gap: ${getThemeValue('spacing.medium.gap')};
`;

const WorkflowControlsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${getThemeValue('spacing.medium.gap')};
  margin-bottom: ${getThemeValue('spacing.medium.gap')};
  padding: ${getThemeValue('spacing.medium.padding')};
  background-color: ${getThemeValue('colors.background.secondary')};
  border: ${getThemeValue('border.width')} ${getThemeValue('border.style')} ${getThemeValue('colors.border.primary')};
  border-radius: ${getThemeValue('spacing.medium.borderRadius')};
  align-items: start;
`;

const HistoryContainer = styled('div')`
  margin-top: ${getThemeValue('spacing.large.gap')};
`;

const HistoryTitle = styled('h3')`
  margin-bottom: ${getThemeValue('spacing.small.gap')};
  font-size: 1rem;
  color: ${getThemeValue('colors.text.secondary')};
`;

const HiddenFileInput = styled('input')`
  display: none;
`;

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
  
  // Input audio files for audio workflows (array of {url, mediaData})
  const [inputAudios, setInputAudios] = useState([]);
  
  // All available workflows (for lookup)
  const [workflows, setWorkflows] = useState([]);
  
  // Gallery selection state
  const [gallerySelectionMode, setGallerySelectionMode] = useState({ active: false, index: -1 });
  
  // Folder state
  const [currentFolder, setCurrentFolder] = useState({ uid: '', label: 'Unsorted' });

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

        // Load current folder
        const folderData = await fetchJson('/folder');
        if (folderData && folderData.current !== undefined) {
          const currentFolderObj = folderData.list.find(f => f.uid === folderData.current) || { uid: '', label: 'Unsorted' };
          setCurrentFolder(currentFolderObj);
        }

        // Load recent history
        const recent = await fetchJson('/media-data?limit=10');
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
    // Reset input images and audio when workflow changes
    setInputImages([]);
    setInputAudios([]);
    
    // Initialize extraInputs in formState with default values
    if (newWorkflow && newWorkflow.extraInputs && Array.isArray(newWorkflow.extraInputs)) {
      const extraInputDefaults = {};
      newWorkflow.extraInputs.forEach(input => {
        if (input.default !== undefined) {
          extraInputDefaults[input.id] = input.default;
        }
      });
      
      // Update formState with new defaults, preserving existing values not from extraInputs
      setFormState(prev => {
        // Remove old extraInput values that are no longer in the new workflow
        const newState = { ...prev };
        
        // Add new extraInput defaults
        Object.assign(newState, extraInputDefaults);
        
        return newState;
      });
    }
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
        // For uploads, we don't have server-side metadata yet, so mediaData is empty
        newImages[index] = { blob: fileOrUrl, url, mediaData: {} };
      } else if (typeof fileOrUrl === 'string') {
        // It's a URL
        newImages[index] = { url: fileOrUrl, mediaData: {} };
      }
      return newImages;
    });
  };
  
  // Handle gallery selection for a specific image slot
  const handleSelectFromGallery = (targetIndex) => {
    setGallerySelectionMode({ active: true, index: targetIndex, type: 'image' });
    setIsGalleryOpen(true);
  };
  
  // Handle audio change for a specific slot
  const handleAudioChange = (index, audioUrlOrData) => {
    setInputAudios(prev => {
      const newAudios = [...prev];
      if (audioUrlOrData === null) {
        // Clear the slot
        newAudios[index] = null;
      } else if (typeof audioUrlOrData === 'string') {
        // It's a URL
        newAudios[index] = { url: audioUrlOrData, mediaData: {} };
      } else if (audioUrlOrData && typeof audioUrlOrData === 'object') {
        // It's media data object
        newAudios[index] = { url: audioUrlOrData.audioUrl, mediaData: audioUrlOrData };
      }
      return newAudios;
    });
  };
  
  // Handle gallery selection for a specific audio slot
  const handleSelectAudioFromGallery = (targetIndex) => {
    setGallerySelectionMode({ active: true, index: targetIndex, type: 'audio' });
    setIsGalleryOpen(true);
  };
  
  // Handle "Select as Input" from generated result or gallery
  const handleSelectAsInput = async (mediaData) => {
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
      const imageUrl = mediaData.imageUrl || mediaData.url;
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
          mediaData: mediaData
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
      
      // Check if we have images or audio to send
      const hasImages = inputImages.some(img => img && img.blob);
      const hasAudios = inputAudios.some(audio => audio && audio.url);
      
      let response;
      
      if (hasImages || hasAudios) {
        // Build multipart form data with uploaded images/audio
        const formData = new FormData();
        formData.append('prompt', formState.description);
        formData.append('workflow', workflow.name);
        formData.append('seed', formState.seed);
        
        if (formState.name.trim()) {
          formData.append('name', formState.name.trim());
        }
        
        // Add orientation for workflows that need it
        formData.append('orientation', orientation);
        
        // Add all extra inputs from workflow configuration
        if (workflow.extraInputs && Array.isArray(workflow.extraInputs)) {
          workflow.extraInputs.forEach(input => {
            const value = formState[input.id];
            if (value !== undefined && value !== null && value !== '') {
              formData.append(input.id, value);
            }
          });
        }
        
        // Append images
        const mediaTextFieldNames = ['description', 'prompt', 'summary', 'tags', 'name', 'uid'];
        const imageTextFieldNames = [...mediaTextFieldNames, 'imageFormat'];
        inputImages.forEach((img, index) => {
          if (img && img.blob) {
            formData.append(`image_${index}`, img.blob, `image_${index}.png`);

            imageTextFieldNames.forEach(fieldName => {
              // Check top-level (legacy/upload) or nested in mediaData (selected)
              const value = img.mediaData?.[fieldName] || img[fieldName];
              if (value) {
                formData.append(`image_${index}_${fieldName}`, value);
              }
            });
          }
        });
        
        const audioTextFieldNames = [...mediaTextFieldNames, 'audioFormat'];
        // Append audio files as blobs (from gallery selection)
        inputAudios.forEach((audio, index) => {
          if (audio && audio.blob) {
            // Extract the original filename from the audio URL (e.g., "/media/audio_123.mp3" -> "audio_123.mp3")
            const originalFilename = audio.url ? audio.url.split('/').pop() : `audio_${index}.mp3`;
            formData.append(`audio_${index}`, audio.blob, originalFilename);
            
            audioTextFieldNames.forEach(fieldName => {
              // Check top-level (legacy/upload) or nested in mediaData (selected)
              const value = audio.mediaData?.[fieldName] || audio[fieldName];
              if (value) {
                formData.append(`audio_${index}_${fieldName}`, value);
              }
            });
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
          orientation: orientation
        };
        
        // Add all extra inputs from workflow configuration
        if (workflow.extraInputs && Array.isArray(workflow.extraInputs)) {
          workflow.extraInputs.forEach(input => {
            const value = formState[input.id];
            if (value !== undefined && value !== null && value !== '') {
              requestBody[input.id] = value;
            }
          });
        }

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
        const img = await fetchJson(`/media-data/${data.result.uid}`);
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
      await fetchJson('/media-data/delete', {
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
    
    if (data.mediaData) {
      // Update the generated image display with complete data
      setGeneratedImage(data.mediaData);
      
      // Update history item by uid
      setHistory(prev => prev.map(item => 
        item.uid === data.mediaData.uid ? data.mediaData : item
      ));
      
      toast.success('Regeneration complete');
    }
  };

  const handleRegenerateError = (data) => {
    console.error('Regenerate error:', data);
    setRegenerateTaskId(null);
    toast.error(data.error?.message || 'Regeneration failed');
  };

  // Folder handlers
  const handleOpenFolderSelect = () => {
    showFolderSelect(async (selectedUid) => {
      try {
        // Call POST /folder to select the folder on the server
        const response = await fetch('/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: selectedUid })
        });
        
        if (!response.ok) {
          throw new Error('Failed to select folder');
        }
        
        const folderData = await response.json();
        const selectedFolder = folderData.list.find(f => f.uid === selectedUid) || { uid: '', label: 'Unsorted' };
        
        // Update current folder state
        setCurrentFolder(selectedFolder);
        
        // Refresh gallery to show images from the new folder
        const recent = await fetchJson(`/media-data?limit=10&folder=${selectedUid}`);
        if (Array.isArray(recent)) {
          setHistory(recent);
          if (recent.length > 0) {
            setGeneratedImage(recent[0]);
          } else {
            setGeneratedImage(null);
          }
        }
        
        toast.success(`Switched to folder: ${selectedFolder.label}`);
      } catch (err) {
        console.error('Failed to switch folder:', err);
        toast.error('Failed to switch folder');
      }
    }, null, null, null, currentFolder.uid);
  };

  // Gallery handlers
  const handleGallerySelect = async (item) => {
     if (gallerySelectionMode.active) {
         // Selection mode: Use media as input
         if (gallerySelectionMode.type === 'audio') {
             // Audio selection
             const audioUrl = item.audioUrl;
             if (audioUrl) {
                 try {
                     // Fetch the audio as a blob so it can be sent to the server
                     const response = await fetch(audioUrl);
                     const blob = await response.blob();
                     
                     setInputAudios(prev => {
                         const newAudios = [...prev];
                         newAudios[gallerySelectionMode.index] = { 
                             blob,
                             url: audioUrl, 
                             mediaData: item
                         };
                         return newAudios;
                     });
                     
                     toast.success('Audio selected from gallery');
                 } catch (err) {
                     console.error('Failed to fetch audio from gallery:', err);
                     toast.error('Failed to select audio from gallery');
                 }
             }
         } else {
             // Image selection
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
                             mediaData: item
                         };
                         return newImages;
                     });
                     
                     toast.success('Image selected from gallery');
                 } catch (err) {
                     console.error('Failed to fetch image from gallery:', err);
                     toast.error('Failed to select image from gallery');
                 }
             }
         }
         setIsGalleryOpen(false);
         setGallerySelectionMode({ active: false, index: -1, type: null });
     } else {
         // View mode: View generated result
         setGeneratedImage(item);
         // Also ensure it's in history (if not already)
         if (!history.find(h => h.uid === item.uid)) {
             setHistory(prev => [item, ...prev]);
         }
     }
  };

  // Navigator handlers
  const handleNavigatorSelect = (item) => {
    setGeneratedImage(item);
  };

  // Upload handler
  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Determine file type
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isImage && !isAudio) {
      toast.error('Please select an image or audio file');
      return;
    }
    
    try {
      const formData = new FormData();
      
      // Use appropriate form field name based on file type
      const fieldName = isAudio ? 'audio' : 'image';
      formData.append(fieldName, file);
      
      // Extract name from filename
      const extractedName = extractNameFromFilename(file.name);
      if (extractedName) {
        formData.append('name', extractedName);
      }
      
      // Use appropriate endpoint based on file type
      const endpoint = isAudio ? '/upload/audio' : '/upload/image';
      
      const result = await fetchJson(endpoint, {
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
    <${AppContainer}>
      <${AppHeader}>
        <${HeaderTitle}>YAAIIG <small>V2</small><//>
        <${HeaderButtons}>
          <${Button} 
            id="folder-btn"
            onClick=${handleOpenFolderSelect}
            variant="small-icon"
          >
            <box-icon name='folder' color=${getThemeValue('colors.text.primary')}></box-icon>
            ${currentFolder.label}
          <//>
          <${Button} 
            id="gallery-btn"
            onClick=${() => setIsGalleryOpen(true)}
            variant="small-icon"
          >
            <box-icon name='images' color=${getThemeValue('colors.text.primary')}></box-icon>
            Gallery
          <//>
        <//>
      <//>
      
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
        />
      ` : null}
      
      <${WorkflowControlsContainer}>
        <${WorkflowSelector}
          value=${workflow}
          onChange=${handleWorkflowChange}
          disabled=${isGenerating}
          typeOptions=${[
            { label: 'Image', value: 'image' },
            { label: 'Video', value: 'video' },
            { label: 'Audio', value: 'audio' }
          ]}
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
          inputAudios=${inputAudios}
          onAudioChange=${handleAudioChange}
          onSelectAudioFromGallery=${handleSelectAudioFromGallery}
        />
      <//>
      
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
          // Disable if the media type doesn't match the workflow type
          const workflowType = workflow.type || 'image';
          const mediaType = generatedImage?.type || 'image';
          if (mediaType !== workflowType) return true;
          // Disable if all slots are filled
          const filledCount = inputImages.filter(img => img && (img.blob || img.url)).length;
          if (filledCount >= workflow.inputImages) return true;
          return false;
        })()}
        isInpaintDisabled=${(() => {
          // Disable if the media type is not an image
          const mediaType = generatedImage?.type || 'image';
          if (mediaType !== 'image') return true;
          return false;
        })()}
      />

      ${history.length > 0 && html`
        <${HistoryContainer}>
          <${HistoryTitle}>Session History<//>
          <${NavigatorComponent} 
            items=${history} 
            selectedItem=${generatedImage}
            onSelect=${handleNavigatorSelect}
            itemsPerPage=${24}
          />
        <//>
      `}

      <${Gallery} 
        isOpen=${isGalleryOpen}
        onClose=${() => {
            setIsGalleryOpen(false);
            setGallerySelectionMode({ active: false, index: -1, type: null });
        }}
        queryPath="/media-data"
        folder=${currentFolder.uid}
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
        fileTypeFilter=${gallerySelectionMode.active ? [gallerySelectionMode.type || 'image'] : null}
        onSelectAsInput=${handleSelectAsInput}
      />
      
      <${HiddenFileInput} 
        type="file" 
        id="upload-file-input" 
        accept="image/*,audio/*"
        onChange=${handleUploadFile}
      />
      
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
          >
            <box-icon name='trash' color="white"></box-icon>
            Delete
          <//>
        `}
      >
        <p>Are you sure you want to delete <strong>"${deleteModalState.image?.name || 'this image'}"</strong>?</p>
        <p style="font-size: 0.9em; color: ${getThemeValue('colors.text.secondary')}; margin-top: 10px;">This action cannot be undone.</p>
      <//>
    <//>
  `;
}

// Mount the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${Page}>
        <${ToastProvider}>
          <${App} />
        <//>
      <//>
    `, root);
    console.log('App V2 mounted successfully');
  } else {
    console.error('Root element #app not found');
  }
});
