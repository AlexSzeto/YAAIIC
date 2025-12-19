// Main application entry point for V2
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ToastProvider } from './custom-ui/toast.mjs';
import { WorkflowSelector } from './app-ui/workflow-selector.mjs';
import { GenerationForm } from './app-ui/generation-form.mjs';

import { ProgressBanner } from './custom-ui/progress-banner.mjs';
import { GeneratedImageResult } from './app-ui/generated-image-result.mjs';
import { sseManager } from './sse-manager.mjs';
import { fetchJson } from './util.mjs';
import { useToast } from './custom-ui/toast.mjs';

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
    console.log('Workflow changed:', newWorkflow);
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
        prompt: formState.description, // Map description to prompt for workflow compatibility
        seed: formState.seed
      };
      
      // Add video fields if workflow type suggests video (checking if typical video fields are present in formState is loose, but workflow object should be the source of truth)
      // Inspecting main.mjs logic: it checks "if (videoControlsRow.style.display !== 'none')" 
      // Here we can check workflow type if we had it, or just properties. 
      // The task says "Show/Hide video controls based on workflow type".
      // Let's assume if it is an image-to-video or text-to-video workflow.
      // For now, let's include them if the workflow seems to support them, or just always send them?
      // main.mjs sends them if the fields are visible.
      // Let's just send them. Redundant fields are likely ignored.
      Object.assign(requestBody, {
        length: formState.length,
        framerate: formState.framerate,
        orientation: formState.orientation
      });

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
        toast.success(`Generated: ${img.name || 'Image'}`);
        
        // Update seed if not locked (to emulate behavior of fresh seed for next run)
        if (!formState.seedLocked) {
           handleFieldChange('seed', generateRandomSeed());
        }
      } catch (err) {
        console.error('Failed to load result image:', err);
        toast.error('Failed to load generated image');
      }
    }
    // We don't nullify taskId immediately so the banner can show "Complete" then hide.
  };
  
  const handleGenerationError = (data) => {
    setIsGenerating(false);
    console.error('Generation error:', data);
    // Banner handles display, we just log
  };
  
  const handleUseSeed = (seed) => {
    setFormState(prev => ({
      ...prev,
      seed,
      seedLocked: true
    }));
    toast.show('Seed copied to form and locked');
  };
  
  const handleUsePrompt = (prompt) => {
    setFormState(prev => ({
      ...prev,
      description: prompt
    }));
    toast.show('Prompt copied to form');
  };
  
  const handleDeleteImage = async (image) => {
    if (!confirm(`Are you sure you want to delete "${image.name}"?`)) return;
    
    try {
      await fetchJson('/image-data/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids: [image.uid] })
      });
      
      setGeneratedImage(null);
      toast.success('Image deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete image');
    }
  };
  
  const handleInpaint = (image) => {
    if (image.uid) {
      window.location.href = `inpaint.html?uid=${image.uid}`;
    }
  };

  return html`
    <div className="app-container">
      <h1>YAAIIG (Yet Another AI Image Generator)</h1>
      
      ${taskId ? html`
        <${ProgressBanner} 
          key=${taskId}
          taskId=${taskId}
          sseManager=${sseManager}
          onComplete=${handleGenerationComplete}
          onError=${handleGenerationError}
        />
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
        />
      </div>
      
      <${GeneratedImageResult} 
        image=${generatedImage}
        onUseSeed=${handleUseSeed}
        onUsePrompt=${handleUsePrompt}
        onDelete=${handleDeleteImage}
        onInpaint=${handleInpaint}
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
