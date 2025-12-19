// Main application entry point for V2
import { render } from 'preact';
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { ToastProvider } from './custom-ui/toast.mjs';
import { WorkflowSelector } from './app-ui/workflow-selector.mjs';
import { GenerationForm } from './app-ui/generation-form.mjs';

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

  return html`
    <div class="app-container">
      <h1>YAAIIG (Yet Another AI Image Generator)</h1>
      
      <div class="workflow-controls">
        <${WorkflowSelector}
          value=${workflow}
          onChange=${handleWorkflowChange}
        />
        
        <${GenerationForm}
          workflow=${workflow}
          formState=${formState}
          onFieldChange=${handleFieldChange}
        />
      </div>
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
