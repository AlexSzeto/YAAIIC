/**
 * Workflow Validator – loads and validates ComfyUI workflow configurations.
 *
 * Responsibilities:
 *   - Loading the workflow definitions from `comfyui-workflows.json`
 *   - Validating that workflows do not contain disallowed nesting of
 *     `executeWorkflow` post-generation processes
 *
 * @module features/generation/workflow-validator
 */
import fs from 'fs';
import { WORKFLOWS_PATH } from '../../core/paths.mjs';

// ---------------------------------------------------------------------------
// Workflow Loading
// ---------------------------------------------------------------------------

/**
 * Load and parse the ComfyUI workflow definitions from disk.
 *
 * @returns {Object} The parsed workflows configuration object.
 * @throws {Error} If the file cannot be read or contains invalid JSON.
 */
export function loadWorkflows() {
  const raw = fs.readFileSync(WORKFLOWS_PATH, 'utf8');
  const workflows = JSON.parse(raw);
  console.log('ComfyUI workflows loaded from', WORKFLOWS_PATH);
  return workflows;
}

// ---------------------------------------------------------------------------
// Workflow Validation
// ---------------------------------------------------------------------------

/**
 * Validates that a workflow does not contain nested executeWorkflow processes.
 *
 * Only a single level of `executeWorkflow` chaining is allowed – a workflow
 * that is itself invoked via `executeWorkflow` must **not** contain another
 * `executeWorkflow` in its own `postGenerationTasks`.
 *
 * The function also detects circular references.
 *
 * @param {Object} workflowConfig - The workflow configuration to validate.
 * @param {Array}  allWorkflows   - Array of all available workflow definitions.
 * @param {Set}    [visited]      - Set of visited workflow names (recursion guard).
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateNoNestedExecuteWorkflow(workflowConfig, allWorkflows, visited = new Set()) {
  // Check if this workflow has postGenerationTasks
  const postGenTasks = workflowConfig.postGenerationTasks;
  if (!postGenTasks || !Array.isArray(postGenTasks)) {
    return { valid: true, error: null };
  }

  // Find all executeWorkflow processes
  const executeWorkflowTasks = postGenTasks.filter(task => task.process === 'executeWorkflow');

  if (executeWorkflowTasks.length === 0) {
    return { valid: true, error: null };
  }

  // For each executeWorkflow task, validate the target workflow
  for (const task of executeWorkflowTasks) {
    const targetWorkflowName = task.parameters?.workflow;

    if (!targetWorkflowName) {
      return {
        valid: false,
        error: `executeWorkflow process missing 'workflow' parameter in workflow "${workflowConfig.name}"`
      };
    }

    // Find the target workflow
    const targetWorkflow = allWorkflows.find(w => w.name === targetWorkflowName);

    if (!targetWorkflow) {
      return {
        valid: false,
        error: `Target workflow "${targetWorkflowName}" not found for executeWorkflow in workflow "${workflowConfig.name}"`
      };
    }

    // Check for circular reference
    if (visited.has(targetWorkflowName)) {
      return {
        valid: false,
        error: `Circular workflow reference detected: "${targetWorkflowName}" in workflow "${workflowConfig.name}"`
      };
    }

    // Check if target workflow has any executeWorkflow processes (nesting not allowed)
    const targetPostGenTasks = targetWorkflow.postGenerationTasks;
    if (targetPostGenTasks && Array.isArray(targetPostGenTasks)) {
      const hasNestedExecuteWorkflow = targetPostGenTasks.some(t => t.process === 'executeWorkflow');

      if (hasNestedExecuteWorkflow) {
        return {
          valid: false,
          error: `Nested executeWorkflow detected: workflow "${targetWorkflowName}" contains executeWorkflow process. Only one level of nesting is allowed.`
        };
      }
    }

    // Recursively validate the target workflow (for other validation, not executeWorkflow)
    const newVisited = new Set(visited);
    newVisited.add(workflowConfig.name);
    const targetValidation = validateNoNestedExecuteWorkflow(targetWorkflow, allWorkflows, newVisited);

    if (!targetValidation.valid) {
      return targetValidation;
    }
  }

  return { valid: true, error: null };
}
