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
// Type Definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} WorkflowsConfig
 * @property {WorkflowDefinition[]} workflows
 * @property {(LLMTask|MathTask)[]} [defaultImageGenerationTasks] - LLM/math tasks that run after every image generation unless a workflow overrides them
 */

/**
 * @typedef {Object} WorkflowDefinition
 * @property {string} name - Unique display name shown in the UI
 * @property {string} base - Filename of the ComfyUI workflow JSON in server/resource/
 * @property {WorkflowOptions} options - UI behaviour and input validation
 * @property {boolean} [hidden=false] - Hide from client workflow lists
 * @property {(DirectReplacement|ConditionalReplacement)[]} [replace] - Modifications applied to the workflow JSON before submission
 * @property {(LLMTask|MathTask)[]} [preGenerationTasks] - Tasks to run before ComfyUI execution
 * @property {(LLMTask|MathTask)[]} [postGenerationTasks] - Tasks to run after ComfyUI execution (overrides defaultImageGenerationTasks)
 * @property {string} [extractOutputPathFromTextFile] - For video workflows that write an output path to a text file
 * @property {string[]} [extractOutputTexts] - Property names to read from storage-folder text files (e.g. ['summary'] reads summary.txt → generationData.summary)
 */

/**
 * @typedef {Object} WorkflowOptions
 * @property {'image'|'video'|'audio'|'inpaint'} type - Generation mode
 * @property {boolean} [autocomplete=false] - Enable Danbooru tag autocompletion for the prompt field
 * @property {number} [inputImages=0] - Number of input images required
 * @property {number} [inputAudios=0] - Number of input audio clips required
 * @property {boolean} [optionalPrompt=false] - Allow an empty prompt
 * @property {boolean} [nameRequired=false] - Require a name before generation starts
 * @property {'portrait'|'landscape'|'detect'} [orientation] - Output orientation handling
 * @property {ExtraInput[]} [extraInputs] - Additional input fields rendered in the generation form
 */

/**
 * @typedef {Object} ExtraInput
 * @property {string} id - Field name in generationData and extraInputs
 * @property {'text'|'number'|'select'|'checkbox'|'textarea'} type
 * @property {string} label - Display label
 * @property {*} [default] - Default value
 * @property {{ label: string, value: * }[]} [options] - Choices for select inputs
 */

/**
 * Direct replacement: maps a generationData field to a ComfyUI workflow node input.
 * @typedef {Object} DirectReplacement
 * @property {string} from - Source field in generationData (e.g. 'prompt', 'seed', 'saveImagePath', 'image_0_filename')
 * @property {[string, string, string]} to - Target path [NodeID, 'inputs', keyName]
 */

/**
 * Conditional replacement: sets a workflow node input to a fixed value when a condition is true.
 * @typedef {Object} ConditionalReplacement
 * @property {Condition} condition
 * @property {*} value - Value to set when condition is true
 * @property {[string, string, string]} to - Target path [NodeID, 'inputs', keyName]
 */

/**
 * LLM inference, template expansion, or field copy task. Exactly one of `model`, `template`, or `from` must be set.
 * @typedef {Object} LLMTask
 * @property {string} to - Target field in generationData to write the result
 * @property {string} [model] - Ollama model name for LLM inference (mutually exclusive with template/from)
 * @property {string} [prompt] - Prompt with {{variableName}} placeholders (used with model)
 * @property {string} [imagePath] - generationData field containing the image path for vision tasks
 * @property {string} [template] - Template string with {{variableName}} placeholders (mutually exclusive with model/from)
 * @property {string} [from] - Source field to copy (mutually exclusive with model/template)
 * @property {Condition} [condition] - Task is skipped when condition is false
 */

/**
 * Chains arithmetic formula steps on a generationData field.
 * @typedef {Object} MathTask
 * @property {string} from - Source field in generationData
 * @property {string} to - Target field in generationData
 * @property {MathFormulaStep[]} math - Ordered steps; each step receives the output of the previous
 * @property {Condition} [condition]
 */

/**
 * Single arithmetic step: `result = (value + offset) * scale + bias`, then optionally rounded.
 * @typedef {Object} MathFormulaStep
 * @property {number} [offset=0]
 * @property {number} [scale=1]
 * @property {number} [bias=0]
 * @property {'none'|'floor'|'ceil'} [round='none']
 */

/**
 * @typedef {SimpleCondition|OrCondition|AndCondition} Condition
 */

/**
 * @typedef {Object} SimpleCondition
 * @property {{ data?: string, generationData?: string }} where - Names the field to inspect (undefined/null/whitespace treated as empty string when comparing with '')
 * @property {{ value: * }} equals - The expected value
 */

/** @typedef {{ or: Condition[] }} OrCondition - True if any sub-condition is true */
/** @typedef {{ and: Condition[] }} AndCondition - True only if all sub-conditions are true */

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
