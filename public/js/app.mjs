// Main application entry point for V2
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { ToastProvider, useToast } from './custom-ui/toast.mjs';
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
        const recent = await fetchJson('/image-data?limit=20');
        if (Array.isArray(recent)) {
          setHistory(recent);
          // Optionally set the first image as current?
          // if (recent.length > 0 && !generatedImage) setGeneratedImage(recent[0]);
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

    try {
      setIsGenerating(true);
      
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

      const response = await fetchJson('/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
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
  
  const handleDeleteImage = async (image) => {
    if (!confirm(`Are you sure you want to delete "${image.name}"?`)) return;
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
          onUploadClick=${() => document.getElementById('upload-btn')?.click()} 
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
        selectionMode=${true}
      />
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
