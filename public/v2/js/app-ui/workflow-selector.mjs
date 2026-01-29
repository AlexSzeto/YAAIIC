import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { styled } from 'goober';
import { Select } from '../custom-ui/io/select.mjs';
import { fetchJson } from '../custom-ui/util.mjs';
import { getThemeValue } from '../custom-ui/theme.mjs';

const Container = styled('div')`
  display: flex;
  gap: ${getThemeValue('spacing.medium.gap')};
  flex: 1 1 auto;
  align-items: end;
  width: 100%;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

/**
 * Workflow Selector Component
 * Fetches and displays available workflows from the server
 * 
 * @param {Object} props
 * @param {Object|null} props.value - Selected workflow object
 * @param {Function} props.onChange - Callback when workflow changes (workflow) => void
 * @param {boolean} [props.disabled=false] - Whether the selector is disabled
 * @param {string|string[]} [props.filterType] - Optional filter for workflow types ('image', 'video', 'inpaint')
 * @param {Array<{label: string, value: string}>} [props.typeOptions] - Optional array of type options for the type selector
 */
export function WorkflowSelector({ value, onChange, disabled = false, filterType, typeOptions }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Initialize selectedType from typeOptions on mount
  useEffect(() => {
    if (typeOptions && typeOptions.length > 0) {
      setSelectedType(typeOptions[0].value);
    }
  }, []);

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
        
        setWorkflows(data);
        console.log('Workflows loaded:', data);
      } catch (err) {
        console.error('Error loading workflows:', err);
        setError('Failed to load workflows');
      } finally {
        setLoading(false);
      }
    }

    loadWorkflows();
  }, []);
  
  // Filter workflows based on typeOptions/selectedType or filterType
  const filteredWorkflows = (() => {
    if (typeOptions && selectedType) {
      // Use type selector filter
      return workflows.filter(w => w.type === selectedType);
    } else if (filterType) {
      // Use filterType prop (for backward compatibility)
      const types = Array.isArray(filterType) ? filterType : [filterType];
      return workflows.filter(w => types.includes(w.type));
    } else {
      // Default: exclude inpaint workflows (backwards compatible)
      return workflows.filter(
        w => w.type === 'image' || w.type === 'video'
      );
    }
  })();
  
  // Auto-select first workflow when filtered workflows change
  useEffect(() => {
    if (filteredWorkflows.length > 0 && !value) {
      onChange(filteredWorkflows[0]);
    }
  }, [filteredWorkflows.length, selectedType]);

  // Handle select change
  const handleChange = (e) => {
    const selectedName = e.target.value;
    if (!selectedName) {
      onChange(null);
      return;
    }
    
    const workflow = filteredWorkflows.find(w => w.name === selectedName);
    if (workflow) {
      onChange(workflow);
    }
  };
  
  // Handle type selector change
  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setSelectedType(newType);
    // Clear current selection when type changes
    onChange(null);
  };

  // Build options for select
  const options = [
    { label: loading ? 'Loading workflows...' : 'Select a workflow...', value: '' },
    ...filteredWorkflows.map(w => ({ label: w.name, value: w.name }))
  ];
  
  const showTypeSelector = typeOptions && typeOptions.length > 1;

  return html`
    <${Container}>
      ${showTypeSelector && html`
        <${Select}
          label="Workflow Type"
          options=${typeOptions}
          value=${selectedType || ''}
          onChange=${handleTypeChange}
          disabled=${loading || disabled}
          fullWidth=${false}
        />
      `}
      <${Select}
        label="Workflow"
        options=${options}
        value=${value?.name || ''}
        onChange=${handleChange}
        disabled=${loading || disabled}
        error=${error}
        fullWidth=${true}
      />
    <//>
  `;
}
