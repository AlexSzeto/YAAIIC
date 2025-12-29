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
 * @param {string|string[]} [props.filterType] - Optional filter for workflow types ('image', 'video', 'inpaint')
 */
export function WorkflowSelector({ value, onChange, disabled = false, filterType }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch workflows on mount
  useEffect(() => {
    async function loadWorkflows() {
      try {
        setLoading(true);
        setError(null);
        
        const data = await fetchJson('/workflows', {}, {
          maxRetries: 3,
          retryDelay: 1000,
          showUserFeedback: true,
          showSuccessFeedback: false
        });
        
        // Filter workflows based on filterType prop
        let filteredWorkflows;
        if (filterType) {
          const types = Array.isArray(filterType) ? filterType : [filterType];
          filteredWorkflows = data.filter(w => types.includes(w.type));
        } else {
          // Default: exclude inpaint workflows (backwards compatible)
          filteredWorkflows = data.filter(
            w => w.type === 'image' || w.type === 'video'
          );
        }
        
        setWorkflows(filteredWorkflows);
        console.log('Workflows loaded:', filteredWorkflows);
        
        // Auto-select first workflow if available and nothing selected
        if (filteredWorkflows.length > 0 && !value) {
          onChange(filteredWorkflows[0]);
        }
      } catch (err) {
        console.error('Error loading workflows:', err);
        setError('Failed to load workflows');
      } finally {
        setLoading(false);
      }
    }

    loadWorkflows();
  }, [filterType]);

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
