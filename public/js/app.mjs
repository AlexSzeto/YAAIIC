// Main application entry point for V3
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from 'goober';
import { Page } from './custom-ui/layout/page.mjs';
import { ToastProvider, useToast } from './custom-ui/msg/toast.mjs';

import { Button } from './custom-ui/io/button.mjs';
import { ProgressBanner } from './custom-ui/msg/progress-banner.mjs';
import { Panel } from './custom-ui/layout/panel.mjs';
import { H1, H2, H3, HorizontalLayout, VerticalLayout } from './custom-ui/themed-base.mjs';
import { AppHeader } from './app-ui/themed-base.mjs';
import { getThemeValue, toggleTheme, currentTheme } from './custom-ui/theme.mjs';

import { WorkflowSelector } from './app-ui/workflow-selector.mjs';
import { GenerationForm } from './app-ui/generation-form.mjs';
import { GeneratedResult } from './app-ui/generated-result.mjs';
import { Gallery } from './app-ui/gallery.mjs';
import { NavigatorControl } from './custom-ui/nav/navigator.mjs';
import { useItemNavigation } from './custom-ui/nav/use-item-navigation.mjs';
import { showFolderSelect } from './app-ui/folder-select.mjs';
import { showDialog } from './custom-ui/overlays/dialog.mjs';

import { sseManager } from './app-ui/sse-manager.mjs';
import { fetchJson, extractNameFromFilename } from './custom-ui/util.mjs';
import { initAutoComplete } from './app-ui/autocomplete-setup.mjs';
import { loadTags } from './app-ui/tags.mjs';
import { loadTagDefinitions } from './app-ui/tag-data.mjs';
import { HoverPanelProvider, useHoverPanel } from './custom-ui/overlays/hover-panel.mjs';
import { createGalleryPreview } from './app-ui/gallery-preview.mjs';
import { HamburgerMenu } from './custom-ui/nav/HamburgerMenu.mjs';

// =========================================================================
// Styled Components
// =========================================================================

const HiddenFileInput = styled('input')`
  display: none;
`;
HiddenFileInput.className = 'hidden-file-input';

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
  const hoverPanel = useHoverPanel();
  
  // Theme state
  const [themeName, setThemeName] = useState(currentTheme.value.name);
  
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

  // Theme toggle handler
  const handleToggleTheme = () => {
    toggleTheme();
    setThemeName(currentTheme.value.name);
  };

  // Subscribe to theme changes
  useEffect(() => {
    const unsubscribe = currentTheme.subscribe((theme) => {
      setThemeName(theme.name);
    });
    return unsubscribe;
  }, []);
  
  // Favicon spinning effect for active tasks
  useEffect(() => {
    if (!window.favloader) return;
    
    // Initialize favloader once
    if (!window.favloaderInitialized) {
      console.log('Initializing');
      window.favloader.init({
        size: 16,
        radius: 6,
        thickness: 2,
        color: '#FFFFFF',
        duration: 5000
      });
      window.favloaderInitialized = true;
    }
    
    if (taskId || regenerateTaskId) {
      console.log('Starting load icon');
      window.favloader.start();
    } else {
      window.favloader.stop();
      console.log('Stopping load icon');
    }
  }, [taskId, regenerateTaskId]);

  // Initialize autocomplete & Load Initial History
  useEffect(() => {
    async function init() {
      try {
        // Load workflows for lookup
        const workflowData = await fetchJson('/workflows');
        if (Array.isArray(workflowData)) {
          // Filter to exclude only inpaint workflows (include all other types dynamically)
          const nonInpaintWorkflows = workflowData.filter(w => w.type !== 'inpaint');
          setWorkflows(nonInpaintWorkflows);
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
      
      // Update formState with new defaults
      setFormState(prev => ({
        ...prev,
        ...extraInputDefaults
      }));
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
    // Detect media type
    const mediaType = mediaData.type || 'image';
    
    if (mediaType === 'audio') {
      // Handle audio selection
      const requiredSlots = workflow?.inputAudios || 0;
      let targetIndex = -1;
      
      for (let i = 0; i < requiredSlots; i++) {
        if (!inputAudios[i]) {
          targetIndex = i;
          break;
        }
      }
      
      if (targetIndex === -1) {
        toast.error('All input audio slots are filled');
        return;
      }
      
      try {
        // Get audio URL
        const audioUrl = mediaData.audioUrl || mediaData.url;
        if (!audioUrl) {
          toast.error('No audio URL available');
          return;
        }
        
        setInputAudios(prev => {
          const newAudios = [...prev];
          newAudios[targetIndex] = { 
            url: audioUrl, 
            mediaData: mediaData
          };
          return newAudios;
        });
        
        toast.success('Audio selected as input');
      } catch (err) {
        console.error('Failed to select audio as input:', err);
        toast.error('Failed to select audio as input');
      }
    } else {
      // Handle image selection
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
    
    // Validate required audio files
    if (workflow.inputAudios && workflow.inputAudios > 0) {
      const uploadedCount = inputAudios.filter(audio => audio && audio.url).length;
      if (uploadedCount < workflow.inputAudios) {
        toast.error(`Please select ${workflow.inputAudios} input audio file(s)`);
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

    // Generate new seed if not locked
    let seedToUse = formState.seed;
    if (!formState.seedLocked) {
      seedToUse = generateRandomSeed();
      handleFieldChange('seed', seedToUse);
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
        formData.append('seed', seedToUse);
        
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
        // Fetch audio files as blobs if needed
        for (let index = 0; index < inputAudios.length; index++) {
          const audio = inputAudios[index];
          if (audio) {
            let audioBlob = audio.blob;
            
            // If audio doesn't have a blob but has a URL, fetch it
            if (!audioBlob && audio.url) {
              try {
                const response = await fetch(audio.url);
                if (!response.ok) {
                  throw new Error(`Failed to fetch audio: ${response.statusText}`);
                }
                audioBlob = await response.blob();
              } catch (fetchError) {
                console.error(`Failed to fetch audio from ${audio.url}:`, fetchError);
                toast.error(`Failed to load audio file ${index + 1}`);
                setIsGenerating(false);
                return;
              }
            }
            
            if (audioBlob) {
              // Extract the original filename from the audio URL (e.g., "/media/audio_123.mp3" -> "audio_123.mp3")
              const originalFilename = audio.url ? audio.url.split('/').pop() : `audio_${index}.mp3`;
              formData.append(`audio_${index}`, audioBlob, originalFilename);
              
              audioTextFieldNames.forEach(fieldName => {
                // Check top-level (legacy/upload) or nested in mediaData (selected)
                const value = audio.mediaData?.[fieldName] || audio[fieldName];
                if (value) {
                  formData.append(`audio_${index}_${fieldName}`, value);
                }
              });
            }
          }
        }
        
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
          seed: seedToUse,
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
      } catch (err) {
        console.error('Failed to load result image:', err);
        toast.error('Failed to load generated image');
      }
    }
  };
  
  const handleGenerationError = (data) => {
    setIsGenerating(false);
    setTaskId(null);
    toast.error(data.error?.message || 'Generation failed');
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

  const handleReprompt = async (image) => {
    if (!image) return;

    try {
      // Find the workflow object by name
      const wf = workflows.find(w => w.name === image.workflow);
      if (!wf) {
        toast.error(`Workflow '${image.workflow}' not found`);
        return;
      }

      // Set the workflow
      setWorkflow(wf);

      // Prepare the new form state with base fields
      const newFormState = {
        seed: String(image.seed),
        seedLocked: true,
        name: image.name || '',
        description: image.prompt || image.description || ''
      };

      // Add all extra input values from the image data
      if (wf.extraInputs && Array.isArray(wf.extraInputs)) {
        wf.extraInputs.forEach(input => {
          // Check if the image data has a value for this extra input
          if (image[input.id] !== undefined) {
            newFormState[input.id] = image[input.id];
          } else if (input.default !== undefined) {
            // Use the default value if not present in image data
            newFormState[input.id] = input.default;
          }
        });
      }

      // Update the form state with all values at once
      setFormState(prev => ({
        ...prev,
        ...newFormState
      }));

      // Restore input images if they exist in the generation data
      const newInputImages = [];
      if (wf.inputImages && wf.inputImages > 0) {
        for (let i = 0; i < wf.inputImages; i++) {
          const uidKey = `image_${i}_uid`;
          if (image[uidKey]) {
            try {
              // Fetch the media data for this input image
              const inputImageData = await fetchJson(`/media-data/${image[uidKey]}`);
              if (inputImageData && inputImageData.imageUrl) {
                // Fetch as blob
                const response = await fetch(inputImageData.imageUrl);
                const blob = await response.blob();
                newInputImages[i] = {
                  blob,
                  url: inputImageData.imageUrl,
                  mediaData: inputImageData
                };
              }
            } catch (err) {
              console.error(`Failed to load input image ${i}:`, err);
            }
          }
        }
      }
      if (newInputImages.length > 0) {
        setInputImages(newInputImages);
      }

      // Restore input audio if they exist in the generation data
      const newInputAudios = [];
      if (wf.inputAudios && wf.inputAudios > 0) {
        for (let i = 0; i < wf.inputAudios; i++) {
          const uidKey = `audio_${i}_uid`;
          if (image[uidKey]) {
            try {
              // Fetch the media data for this input audio
              const inputAudioData = await fetchJson(`/media-data/${image[uidKey]}`);
              if (inputAudioData && inputAudioData.audioUrl) {
                // Fetch as blob
                const response = await fetch(inputAudioData.audioUrl);
                const blob = await response.blob();
                newInputAudios[i] = {
                  blob,
                  url: inputAudioData.audioUrl,
                  mediaData: inputAudioData
                };
              }
            } catch (err) {
              console.error(`Failed to load input audio ${i}:`, err);
            }
          }
        }
      }
      if (newInputAudios.length > 0) {
        setInputAudios(newInputAudios);
      }

      toast.success('All generation settings loaded from result');
    } catch (error) {
      console.error('Failed to load generation settings:', error);
      toast.error('Failed to load generation settings');
    }
  };
  
  const handleDeleteImage = async (image) => {
    if (!image) return;

    const result = await showDialog(
      `Are you sure you want to delete "${image.name || 'this image'}"? This action cannot be undone.`,
      'Confirm Deletion',
      ['Delete', 'Cancel']
    );

    if (result !== 'Delete') return;

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

  // Handle gallery deletion - update session history
  const handleGalleryDelete = (deletedUids) => {
    if (!deletedUids || deletedUids.length === 0) return;
    
    // Remove deleted items from history
    const newHistory = history.filter(item => !deletedUids.includes(item.uid));
    setHistory(newHistory);
    
    // If currently displayed image was deleted, switch to another item
    if (generatedImage && deletedUids.includes(generatedImage.uid)) {
      if (newHistory.length > 0) {
        setGeneratedImage(newHistory[0]);
      } else {
        setGeneratedImage(null);
      }
    }
  };


  // History navigation using useItemNavigation hook
  const historyNav = useItemNavigation(history, generatedImage);
  
  // Sync navigation state with generatedImage
  useEffect(() => {
    if (historyNav.currentItem && historyNav.currentItem !== generatedImage) {
      setGeneratedImage(historyNav.currentItem);
    }
  }, [historyNav.currentItem]);

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
    <${VerticalLayout} gap="large">
      <${AppHeader}>
        <${H1}>YAAIIG <small>V3</small></${H1}>
        <${HorizontalLayout} gap="small">
          <${Button} 
            id="theme-toggle-btn"
            onClick=${handleToggleTheme}
            variant="large-icon"
            icon=${themeName === 'dark' ? 'sun' : 'moon'}
            title=${`Switch to ${themeName === 'dark' ? 'light' : 'dark'} mode`}
          />
          <${Button} 
            id="folder-btn"
            onClick=${handleOpenFolderSelect}
            variant="medium-icon-text"
            icon="folder"
          >
            ${currentFolder.label}
          </${Button}>
          <${Button}
            id="gallery-btn"
            onClick=${() => setIsGalleryOpen(true)}
            variant="medium-icon-text"
            icon="images"
          >
            Gallery
          </${Button}>
          <${HamburgerMenu}
            items=${[{ label: 'Workflow Editor', href: '/workflow-editor.html', icon: 'cog' }]}
            title="More pages"
          />
        </${HorizontalLayout}>
      </${AppHeader}>
      
      <${Panel} variant="outlined">
        <${VerticalLayout}>
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
        </${VerticalLayout}>
      </${Panel}>
      
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
        onReprompt=${handleReprompt}
        onSelectAsInput=${handleSelectAsInput}
        isSelectDisabled=${(() => {
          const mediaType = generatedImage?.type || 'image';
          
          // Check if workflow needs images as input
          if (mediaType === 'image') {
            // Disable if no workflow or workflow doesn't need images
            if (!workflow || !workflow.inputImages || workflow.inputImages <= 0) return true;
            // Disable if all image slots are filled
            const filledCount = inputImages.filter(img => img && (img.blob || img.url)).length;
            if (filledCount >= workflow.inputImages) return true;
            return false;
          }
          
          // Check if workflow needs audio as input
          if (mediaType === 'audio') {
            // Disable if no workflow or workflow doesn't need audio
            if (!workflow || !workflow.inputAudios || workflow.inputAudios <= 0) return true;
            // Disable if all audio slots are filled
            const filledCount = inputAudios.filter(aud => aud && (aud.url)).length;
            if (filledCount >= workflow.inputAudios) return true;
            return false;
          }
          
          // For video or other media types, disable selection (not supported as input yet)
          return true;
        })()}
        isInpaintDisabled=${(() => {
          // Disable if the media type is not an image
          const mediaType = generatedImage?.type || 'image';
          if (mediaType !== 'image') return true;
          return false;
        })()}
      />

      ${history.length > 0 && html`
        <${Panel} variant="outlined">
          <${VerticalLayout}>
            <${H2}>Session History</${H2}>
            <${NavigatorControl} 
              currentPage=${historyNav.currentIndex}
              totalPages=${historyNav.totalItems}
              onNext=${historyNav.selectNext}
              onPrev=${historyNav.selectPrev}
              onFirst=${historyNav.selectFirst}
              onLast=${historyNav.selectLast}
              showFirstLast=${true}
            />
          </${VerticalLayout}>
        </${Panel}>
      `}
    </${VerticalLayout}>

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
      onDelete=${handleGalleryDelete}
    />
    
    <${HiddenFileInput} 
      type="file" 
      id="upload-file-input" 
      accept="image/*,audio/*"
      onChange=${handleUploadFile}
    />
  `;
}

// Mount the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${HoverPanelProvider}>
        <${Page}>
          <${ToastProvider}>
            <${App} />
          </${ToastProvider}>
        </${Page}>
      </${HoverPanelProvider}>
    `, root);
    console.log('App V3 mounted successfully');

    setTimeout(() => {
      // Load tags first, then initialize autocomplete
      loadTags().then(() => {
        initAutoComplete();
        console.log('Autocomplete initialized in App V3');
        
        // Load tag definitions and configure hover panel
        loadTagDefinitions().then(() => {
          console.log('Tag definitions loaded');
        }).catch(err => {
          console.warn('Failed to load tag definitions:', err);
        });
      });
    }, 100);    
  } else {
    console.error('Root element #app not found');
  }
});
