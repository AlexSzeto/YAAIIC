// Inpaint page entry point for V3
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { styled } from 'goober';
import { Page } from './custom-ui/layout/page.mjs';
import { Panel } from './custom-ui/layout/panel.mjs';
import { H1, H2, H3 } from './custom-ui/typography.mjs';
import { getThemeValue, toggleTheme, currentTheme } from './custom-ui/theme.mjs';
import { ToastProvider, useToast } from './custom-ui/msg/toast.mjs';
import { WorkflowSelector } from './app-ui/workflow-selector.mjs';
import { InpaintCanvas } from './app-ui/inpaint-canvas.mjs';
import { InpaintForm } from './app-ui/inpaint-form.mjs';
import { ProgressBanner } from './custom-ui/msg/progress-banner.mjs';
import { NavigatorControl } from './custom-ui/nav/navigator.mjs';
import { useItemNavigation } from './custom-ui/nav/use-item-navigation.mjs';
import { sseManager } from './app-ui/sse-manager.mjs';
import { fetchJson, fetchWithRetry, getQueryParam } from './util.mjs';
import { initAutoComplete } from './app-ui/autocomplete-setup.mjs';
import { loadTags } from './app-ui/tags.mjs';
import { Button } from './custom-ui/io/button.mjs';
import { showFolderSelect } from './app-ui/folder-select.mjs';

// Styled components
const AppContainer = styled('div')`
  margin: 0 auto;

  display: flex;
  flex-direction: column;
  gap: ${getThemeValue('spacing.large.gap')};  
`;

const AppHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderActions = styled('div')`
  display: flex;
  gap: ${getThemeValue('spacing.small.gap')};
`;

const ProgressBannerContainer = styled('div')`
  margin-bottom: ${getThemeValue('spacing.medium.margin')};
`;

const MainLayout = styled('div')`
  display: grid;
  gap: ${getThemeValue('spacing.large.gap')};
  
  @media (min-width: 1024px) {
    grid-template-columns: 1fr 500px;
  }
`;

/**
 * Helper function to generate random seed
 */
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295);
}

/**
 * Utility function to convert canvas to blob
 */
function canvasToBlob(canvas, mimeType = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, mimeType);
  });
}

/**
 * Generate mask canvas from inpaint area
 */
function generateMaskCanvas(width, height, inpaintArea) {
  if (!inpaintArea) {
    throw new Error('Invalid inpaint area');
  }
  
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  
  const ctx = maskCanvas.getContext('2d');
  
  // Clear canvas with black
  ctx.fillStyle = 'rgb(0, 0, 0)';
  ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  
  // Calculate rectangle bounds
  const { x1, y1, x2, y2 } = inpaintArea;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width2 = Math.abs(x2 - x1);
  const height2 = Math.abs(y2 - y1);
  
  // Draw filled rectangle in white
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(left, top, width2, height2);
  
  return maskCanvas;
}

/**
 * Create original image canvas (clean, without overlays)
 */
async function createOriginalImageCanvas(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => {
      reject(new Error('Failed to load original image'));
    };
    img.src = imageUrl;
  });
}

/**
 * Main InpaintApp Component
 */
function InpaintApp() {
  const toast = useToast();
  
  // Theme state
  const [themeName, setThemeName] = useState(currentTheme.value.name);
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [mediaData, setMediaData] = useState(null);
  const [inpaintArea, setInpaintArea] = useState(null);
  const [history, setHistory] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Folder state
  const [currentFolder, setCurrentFolder] = useState({ uid: '', label: 'Unsorted' });
  
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    seed: generateRandomSeed(),
    seedLocked: false
  });

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

  // Initialize and load data on mount
  useEffect(() => {
    async function init() {
      try {
        // Load current folder
        const folderData = await fetchJson('/folder');
        if (folderData && folderData.current !== undefined) {
          const currentFolderObj = folderData.list.find(f => f.uid === folderData.current) || { uid: '', label: 'Unsorted' };
          setCurrentFolder(currentFolderObj);
        }        
        // Get UID from query parameter
        const uid = getQueryParam('uid');
        
        if (!uid) {
          setError('No image UID provided');
          setLoading(false);
          return;
        }
        
        const numericUID = parseInt(uid);
        if (isNaN(numericUID)) {
          setError('Invalid image UID format');
          setLoading(false);
          return;
        }
        
        // Load image data
        const data = await fetchJson(`/media-data/${numericUID}`, {}, {
          maxRetries: 2,
          retryDelay: 1000,
          showUserFeedback: true,
          showSuccessFeedback: false
        });
        
        console.log('Image data loaded:', data);
        setMediaData(data);
        setHistory([data]);
        
        // Populate form with image data
        setFormState(prev => ({
          ...prev,
          name: data.name || '',
          description: data.prompt || '',
          seed: data.seed || generateRandomSeed()
        }));
        
        // Restore inpaint area if available
        if (data.inpaintArea) {
          setInpaintArea(data.inpaintArea);
        }
        
        setLoading(false);
        toast.success('Image loaded for inpainting');
        
      } catch (err) {
        console.error('Failed to initialize inpaint page:', err);
        setError(err.message || 'Failed to load image data');
        setLoading(false);
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
    
    // Initialize extraInputs in formState with default values
    if (newWorkflow && newWorkflow.extraInputs && Array.isArray(newWorkflow.extraInputs)) {
      const extraInputDefaults = {};
      newWorkflow.extraInputs.forEach(input => {
        if (input.default !== undefined) {
          extraInputDefaults[input.id] = input.default;
        }
      });
      
      // Update formState with new defaults
      setFormState(prev => {
        const newState = { ...prev };
        Object.assign(newState, extraInputDefaults);
        return newState;
      });
    }
  };

  // Handle inpaint area change
  const handleInpaintAreaChange = useCallback((newArea) => {
    setInpaintArea(newArea);
  }, []);

  // Handle inpaint generation
  const handleGenerate = async () => {
    if (!workflow) {
      toast.error('Please select a workflow');
      return;
    }
    
    if (!inpaintArea) {
      toast.error('Please select an inpaint area');
      return;
    }
    
    if (!mediaData?.imageUrl) {
      toast.error('No image loaded');
      return;
    }
    
    try {
      setIsGenerating(true);
      toast.show('Preparing inpaint request...');
      
      // Get the original image canvas
      const imageCanvas = await createOriginalImageCanvas(mediaData.imageUrl);
      
      // Determine orientation from image dimensions - default to "detect" if undefined
      let orientation = workflow.orientation || 'detect';
      if (orientation === 'detect') {
        orientation = imageCanvas.height > imageCanvas.width ? 'portrait' : 'landscape';
        console.log(`Detected orientation: ${orientation} (${imageCanvas.width}x${imageCanvas.height})`);
      }
      
      // Generate mask canvas
      const maskCanvas = generateMaskCanvas(
        imageCanvas.width, 
        imageCanvas.height, 
        inpaintArea
      );
      
      // Convert canvases to blobs
      const imageBlob = await canvasToBlob(imageCanvas, 'image/png');
      const maskBlob = await canvasToBlob(maskCanvas, 'image/png');
      
      // Generate mask filename based on dimensions and area
      const maskFilename = `mask_${Math.round(imageCanvas.width)}_${Math.round(imageCanvas.height)}_${Math.round(inpaintArea.x1)}_${Math.round(inpaintArea.y1)}_${Math.round(inpaintArea.x2)}_${Math.round(inpaintArea.y2)}.png`;
      
      // Prepare form data
      const formData = new FormData();
      formData.append('workflow', workflow.name);
      formData.append('name', formState.name.trim());
      formData.append('seed', formState.seed);
      formData.append('prompt', formState.description.trim());
      formData.append('orientation', orientation);
      formData.append('inpaintArea', JSON.stringify(inpaintArea));
      formData.append('maskFilename', maskFilename);
      formData.append('image', imageBlob, 'image.png');
      formData.append('mask', maskBlob, 'mask.png');
      
      // Append image field names from the source mediaData
      const imageTextFieldNames = ['description', 'prompt', 'summary', 'tags', 'name', 'imageFormat'];
      imageTextFieldNames.forEach(fieldName => {
        const value = mediaData[fieldName];
        if (value) {
          formData.append(`image_0_${fieldName}`, value);
        }
      });
      
      // Add all extra inputs from workflow configuration
      if (workflow.extraInputs && Array.isArray(workflow.extraInputs)) {
        workflow.extraInputs.forEach(input => {
          const value = formState[input.id];
          if (value !== undefined && value !== null && value !== '') {
            formData.append(input.id, value);
          }
        });
      }
      
      toast.show('Sending inpaint request...');
      
      // Send request
      const response = await fetchWithRetry('/generate/inpaint', {
        method: 'POST',
        body: formData
      }, {
        maxRetries: 1,
        retryDelay: 2000,
        timeout: 10000,
        showUserFeedback: false
      });
      
      const result = await response.json();
      
      if (!result.taskId) {
        throw new Error('Server did not return a taskId');
      }
      
      setTaskId(result.taskId);
      console.log('Inpaint generation started with taskId:', result.taskId);
      
    } catch (err) {
      console.error('Error during inpaint:', err);
      toast.error(`Inpaint failed: ${err.message}`);
      setIsGenerating(false);
    }
  };

  // Handle generation complete
  const handleGenerationComplete = async (data) => {
    setIsGenerating(false);
    setTaskId(null);
    console.log('Inpaint complete:', data);
    
    if (data.result && data.result.uid) {
      try {
        // Load the new image data
        const newImageData = await fetchJson(`/media-data/${data.result.uid}`);
        setMediaData(newImageData);
        
        // Add to history
        setHistory(prev => [newImageData, ...prev]);
        
        // Update URL with new UID
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('uid', data.result.uid);
        window.history.pushState({}, '', newUrl);
        
        // Reset or preserve inpaint area
        if (data.result.inpaintArea) {
          setInpaintArea(data.result.inpaintArea);
        } else {
          setInpaintArea(null);
        }
        
        // Update seed if not locked
        if (!formState.seedLocked) {
          handleFieldChange('seed', generateRandomSeed());
        }
        
        const timeTaken = data.result.timeTaken;
        const message = timeTaken 
          ? `Inpaint completed in ${timeTaken}s` 
          : 'Inpaint completed successfully!';
        toast.success(message);
        
      } catch (err) {
        console.error('Error loading new image data:', err);
        toast.error('Failed to load inpaint result');
      }
    }
  };

  // Handle generation error
  const handleGenerationError = (data) => {
    setIsGenerating(false);
    setTaskId(null);
    console.error('Inpaint generation failed:', data);
    toast.error(data.error?.message || 'Inpaint generation failed');
  };

  // Handle folder selection
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
        
        toast.success(`Switched to folder: ${selectedFolder.label}`);
      } catch (err) {
        console.error('Failed to switch folder:', err);
        toast.error('Failed to switch folder');
      }
    }, null, null, null, currentFolder.uid);
  };

  // Handle done button
  const handleDone = () => {
    console.log('Navigating back to main page');
    window.location.href = '/';
  };

  // Handle carousel selection
  const handleCarouselSelect = (item) => {
    setMediaData(item);
    
    // Update form with selected image's data
    setFormState(prev => ({
      ...prev,
      name: item.name || prev.name,
      description: item.prompt || prev.description
    }));
    
    // Restore inpaint area if available
    if (item.inpaintArea) {
      setInpaintArea(item.inpaintArea);
    } else {
      setInpaintArea(null);
    }
  };

  // History navigation using useItemNavigation hook
  const historyNav = useItemNavigation(history, mediaData);
  
  // Sync navigation state with mediaData
  useEffect(() => {
    if (historyNav.currentItem && historyNav.currentItem !== mediaData) {
      handleCarouselSelect(historyNav.currentItem);
    }
  }, [historyNav.currentItem]);

  // Determine if we have a valid inpaint area
  const hasValidInpaintArea = inpaintArea && 
    inpaintArea.x1 !== inpaintArea.x2 && 
    inpaintArea.y1 !== inpaintArea.y2;

  return html`
    <${AppContainer}>
      <${AppHeader}>
        <${H1}>YAAIIG <small>Inpaint V3</small></>
        <${HeaderActions}>
          <${Button}
            variant="large-icon"
            icon=${themeName === 'dark' ? 'sun' : 'moon'}
            onClick=${handleToggleTheme}
            title=${`Switch to ${themeName === 'dark' ? 'light' : 'dark'} mode`}
          />
          <${Button}
            icon="home"
            onClick=${handleDone}
            title="Return to main page"
          >
            Home
          <//>
        </>
      </>
      
      ${taskId ? html`
        <${ProgressBannerContainer}>
          <${ProgressBanner} 
            key=${taskId}
            taskId=${taskId}
            sseManager=${sseManager}
            onComplete=${handleGenerationComplete}
            onError=${handleGenerationError}
          />
        </>
      ` : null}
      
      <${MainLayout}>
        <${Panel} variant="outlined" style=${{ minHeight: '400px' }}>
          ${loading && html`
            <p>Loading image for inpainting...</p>
          `}
          
          ${error && html`
            <p>${error}</p>
          `}
          
          ${!loading && !error && mediaData?.imageUrl && html`
            <${InpaintCanvas}
              imageUrl=${mediaData.imageUrl}
              inpaintArea=${inpaintArea}
              onChangeInpaintArea=${handleInpaintAreaChange}
            />
          `}
          
          ${!loading && !error && !mediaData?.imageUrl && html`
            <p>No image loaded for inpainting</p>
          `}
        </>
        
        <${Panel} variant="outlined" style=${{ display: 'flex', flexDirection: 'column', gap: getThemeValue('spacing.large.gap') }}>
          <${WorkflowSelector}
            value=${workflow}
            onChange=${handleWorkflowChange}
            disabled=${isGenerating}
            typeOptions=${[
              { label: 'Inpaint', value: 'inpaint' }
            ]}
          />
          
          <${InpaintForm}
            workflow=${workflow}
            formState=${formState}
            onFieldChange=${handleFieldChange}
            isGenerating=${isGenerating}
            onGenerate=${handleGenerate}
            hasValidInpaintArea=${hasValidInpaintArea}
          />
        </>
      </>
      
      ${history.length > 0 && html`
        <${Panel} variant="outlined">
          <${H2}>Session History</>
          <${NavigatorControl} 
            currentPage=${historyNav.currentIndex}
            totalPages=${historyNav.totalItems}
            onNext=${historyNav.selectNext}
            onPrev=${historyNav.selectPrev}
            onFirst=${historyNav.selectFirst}
            onLast=${historyNav.selectLast}
            showFirstLast=${true}
          />
        </>
      `}
    </>
  `;
}

// Mount the app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('app');
  if (root) {
    render(html`
      <${Page}>
        <${ToastProvider}>
          <${InpaintApp} />
        </>
      <//>
    `, root);
    await loadTags();
    initAutoComplete();
    console.log('Autocomplete initialized in App V3');
    console.log('Inpaint App V3 mounted successfully');
  } else {
    console.error('Root element #app not found');
  }
});
