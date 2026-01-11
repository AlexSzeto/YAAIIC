# Remove prefix and postfix from comfyui-workflows.json
## Goals
Remove prefix and postfix parameters and use template instead.
## Implementation Details
Example of conversion:
```json
{
   "prefix": "masterpiece, best quality, picture of ",
   "from": "prompt",
   "to": ["1", "inputs", "value"],
   "postfix": " in a cinematic style"
}

```
Example task:
```json
{
   "template": "masterpiece, best quality, picture of {{prompt}} in a cinematic style",
   "to": "prompt"
}
```
## Tasks
[] Look through `comfyui-workflows.json` and convert uses of prefix and postfix into a template replacement pre generation task:
[] Delete prefix and postfix processing in `server/generate.mjs`. Delete specifications in `doc/workflows.md`.