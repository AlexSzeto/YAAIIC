# Bug Fixes

## Goals
Address the accumulated non essential bugs and tech debts from the most recent round of features.

## Tasks
[] Add a sent prompt log similar to sent-workflow.json.

> Unlike sent-workflow, at the start of a task, delete the content of sent-prompt.json. Then, for every prompt sent, open sent-prompt.json, add the data for the prompt sent to the end of the file, and write back to the file. Come up with a data format that makes sense for the data being sent and that multiple prompts may be logged in a single task. Be sure to take care of the case if the logs folder or sent-prompt.json doesn't exist.

[] Fix the bug where certain regeneration tasks may be missing context.

> Modify the shape of the regenerate endpoint so it requires the full generation data object. This might aid in certain regeneration tasks that requires text replacement from existing data.

[] Refactor postGenerationTasks out of config.json into comfyui-workflow.json. Remove the entry from the default file.

[] Change the output shape at the end of the generation task so it sends the entire generationData object regardless of what is in it.

> Fields that originally exist outside of generation data, and conditionals that assigns default values to certain generation data fields, should be added to generationData before it's written in the image database. Remove code that has to name specific fields to send to and from the client for generation data.

[] Remove the orientation form field and force all workflows to send orientation.

> On the client side the orientation form field and either expect it as a workflow input, or in the case of "detect", send "portrait" if height > width and "landscape" otherwise (this includes square dimensions). This means that workflows returned from the workflow list will need to send the "orientation" data as well.

[] Refactor all workflow data sent to the client from the workflow list, other than "name", to go inside an "options" object.

> In future feature implementations, it would be implied that anything added to the "options" section of the workflow data would be sent to the client without additional code.

[] Fix a bug where using the "use in form" actions from the generated display section doesn't retrigger validation to enable/disable the generate button.

> If necessary, refactor the validation function so it can be accessed by both interfaces.

[] Change the regeneration task tracking UI to use the progress banner instead of generic toast messages.

[] Fix the total step number resetting between the pre-generate, generate, and post-generate phases.

> Here is a sample of what the event data looks like:
```
event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"(1/1) Generating prompt...","currentValue":0,"maxValue":2},"timestamp":"2025-12-13T17:34:28.476Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":50,"currentStep":"(1/1) Generating prompt complete","currentValue":1,"maxValue":2},"timestamp":"2025-12-13T17:34:29.509Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":50,"currentStep":"(1/1) Generating description...","currentValue":1,"maxValue":2},"timestamp":"2025-12-13T17:34:29.509Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":100,"currentStep":"(1/1) Generating description complete","currentValue":2,"maxValue":2},"timestamp":"2025-12-13T17:34:29.510Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"Starting generation...","currentValue":0,"maxValue":0},"timestamp":"2025-12-13T17:34:29.526Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"(5/18) Processing Load Image...","currentValue":0,"maxValue":0},"timestamp":"2025-12-13T17:34:29.565Z"}
```
For example, the correct `currentStep` for the first item should be `(1/18) Generating prompt`. To simplify estimation, remove the process that calculates the correct number of pre/post generation tasks and instead count every pre/post generation tasks in the total, when a task is skipped, simply add one to the number of tasks completed and continue.