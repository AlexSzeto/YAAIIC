import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { Select } from '../custom-ui/select.mjs';
import { fetchJson } from '../util.mjs';

/**
 * Workflow Selector Component
 * Fetches and displays available workflows from the server
 * 
 * @param {Object} props
 * @param {Object|null} props.value - Selected workflow object
 * @param {Function} props.onChange - Callback when workflow changes (workflow) => void
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 */
export function WorkflowSelector({ value, onChange, disabled = false }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch workflows on mount
  useEffect(() => {
    async function loadWorkflows() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchJson('/generate/workflows', {}, {
          maxRetries: 3,
          retryDelay: 1000,
          showUserFeedback: true,
          showSuccessFeedback: false
        });
        
        // Filter to only image and video workflows (exclude inpaint)
        const imageVideoWorkflows = data.filter(
          w => w.type === 'image' || w.type === 'video'
        );
        
        setWorkflows(imageVideoWorkflows);
        console.log('Workflows loaded:', imageVideoWorkflows);
      } catch (err) {
        console.error('Error loading workflows:', err);
        setError('Failed to load workflows');
      } finally {
        setLoading(false);
      }
    }

    loadWorkflows();
  }, []);

  // Handle select change
  const handleChange = (e) => {
    const selectedName = e.target.value;
    if (!selectedName) {
      onChange(null);
      return;
    }
    
    const workflow = workflows.find(w => w.name === selectedName);
    if (workflow) {
      onChange(workflow);
    }
  };

  // Build options for select
  const options = [
    { label: loading ? 'Loading workflows...' : 'Select a workflow...', value: '' },
    ...workflows.map(w => ({ label: w.name, value: w.name }))
  ];

  return html`
    <${Select}
      label="Workflow"
      options=${options}
      value=${value?.name || ''}
      onChange=${handleChange}
      disabled=${loading || disabled}
      error=${error}
      fullWidth=${true}
    />
  `;
}
