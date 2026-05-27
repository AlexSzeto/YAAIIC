# LLM Chat Assistant

**Priority:** low

## Goal

Import the existing LLM-based chat assistant experiment into this project and introduce a new LLM settings database where users can create and persist named model profiles (e.g. model name, parameters, system prompt).

## Notes

- Source: import from an external experiment rather than building from scratch.
- Model profiles should be saved to a new database (e.g. `llm-settings-data.json`), not folded into `config.json`.
- Open question: what fields does a model profile contain? (model name, temperature, top-p, system prompt, others?)
- Open question: is the chat assistant a standalone page or embedded in other features?
