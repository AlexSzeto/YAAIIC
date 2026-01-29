// Main application entry point for V2
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { ToastProvider, useToast } from './custom-ui/msg/toast.mjs';
import { Page } from './custom-ui/layout/page.mjs';
// import { GenerationForm } from './app-ui/generation-form.mjs'; // Temporarily commented - depends on unrefactored components

/**
 * Helper function to generate random seed
 */
function generateRandomSeed() {
  return Math.floor(Math.random() * 4294967295);
}

/**
 * Main App Component
 */
function App() {
  const toast = useToast();

  /* Temporarily commented - dependencies not yet refactored
  // State management
  const [workflow, setWorkflow] = useState(null);
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    seed: generateRandomSeed(),
    seedLocked: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [inputImages, setInputImages] = useState([]);
  const [inputAudios, setInputAudios] = useState([]);

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
    setInputImages([]);
    setInputAudios([]);
    toast.show('Workflow selected (placeholder)');
  };

  // Handle image change
  const handleImageChange = (index, fileOrUrl) => {
    setInputImages(prev => {
      const newImages = [...prev];
      if (fileOrUrl === null) {
        newImages[index] = null;
      } else if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
        const url = URL.createObjectURL(fileOrUrl);
        newImages[index] = { blob: fileOrUrl, url, mediaData: {} };
      } else if (typeof fileOrUrl === 'string') {
        newImages[index] = { url: fileOrUrl, mediaData: {} };
      }
      return newImages;
    });
  };

  // Handle audio change
  const handleAudioChange = (index, audioUrlOrData) => {
    setInputAudios(prev => {
      const newAudios = [...prev];
      if (audioUrlOrData === null) {
        newAudios[index] = null;
      } else if (typeof audioUrlOrData === 'string') {
        newAudios[index] = { url: audioUrlOrData, mediaData: {} };
      } else if (audioUrlOrData && typeof audioUrlOrData === 'object') {
        newAudios[index] = { url: audioUrlOrData.audioUrl, mediaData: audioUrlOrData };
      }
      return newAudios;
    });
  };

  // Handle generate
  const handleGenerate = () => {
    toast.show('Generate clicked (placeholder)');
  };

  // Handle gallery selections (placeholder)
  const handleSelectFromGallery = (index) => {
    toast.show(`Select from gallery for slot ${index} (placeholder)`);
  };

  const handleSelectAudioFromGallery = (index) => {
    toast.show(`Select audio from gallery for slot ${index} (placeholder)`);
  };
  */

  return html`
    <div style="padding: 20px; max-width: 1200px; margin: 0 auto;">
      <h1>YAAIIG <small style="font-size: 0.5em; opacity: 0.6;">V2</small></h1>
      
      <p style="margin: 20px 0;">
        V2 Main Page - Components will appear here as they are refactored.
      </p>
      
      <!-- Placeholder for WorkflowSelector (not yet refactored) -->
      <div style="margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
        <p style="color: var(--text-secondary);">
          <strong>WorkflowSelector</strong> - Not yet refactored
        </p>
      </div>
      
      <!-- GenerationForm - Refactored but temporarily disabled until dependencies are refactored -->
      <div style="margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
        <p style="color: var(--text-secondary);">
          <strong>GenerationForm</strong> - Refactored but depends on SeedControl and ExtraInputsRenderer (not yet refactored)
        </p>
      </div>
      
      <!-- Placeholder for other components -->
      <div style="margin: 20px 0; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
        <p style="color: var(--text-secondary);">
          <strong>GeneratedResult, Gallery, etc.</strong> - Not yet refactored
        </p>
      </div>
    </div>
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
    console.log('App V3 mounted successfully');
  } else {
    console.error('Root element #app not found');
  }
});
