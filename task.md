
# LLM Integration for Workflow Pre/Post Tasks

## Goals
Implement LLM model selection in the workflow pre/post generation task configuration by fetching available models from Ollama to validate LLM task configurations.

## Tasks

- [ ] In the workflow pre/post generation task configuration, the LLM task model selection should be a select input with the list of models currently installed on ollama as its options. This requires a new endpoint that fetches the list of ollama models. Put the base functionality into llm.mjs since it will be used to validate the existance of LLM models during workflow execution at a later time.
- [ ] Add actions in the workflow selection list to move workflow order up and down.
- [ ] Create a "condensed" variation of the dynamic list where the content of the has no panel container, does not collapse, and the content is place directly to the left of the action buttons. Use this variation for processing -> extractOutputTexts and execute workflow -> input mappings, output mappings.

## Implementation Details

