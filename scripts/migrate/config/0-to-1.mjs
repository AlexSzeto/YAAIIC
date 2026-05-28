/**
 * config migration v0 → v1
 *
 * Adds anytale.dialog (LLM dialog generation config) and
 * anytale.speechWorkflow (TTS workflow name) introduced in play mode rollout 5.
 */

export const fromVersion = 0;
export const toVersion = 1;

export function migrate(config) {
  const anytale = config.anytale ?? {};

  if (!anytale.dialog) {
    
    anytale.dialog = {
      model: 'llama3.2:latest',
      systemMessage:
        "You are a chat companion that is writing spoken lines of dialog to roleplay with a third party user outside of the current conversation. The incoming user texts are instructions to inform you what your character is physically doing. Instead of responding to the user, write a dialog that naturally follows the context of your previous and current actions, as well as your character's personality.\n\nKeep your dialog extremely brief, no longer that two or three lines. Inject your dialog with exaggerated emotion. Write the dialog only, with no quotes or emotes. Do not inject additional instructions.\n\nYour character profile:\nYou are {{name}}, {{profile}}.\n\nCurrent location:\n{{location}}",
      parameters: {
        temperature: 0.8,
        topP: 0.9,
        maxTokens: 200,
      },
      mode: 'chat',
      stream: false,
    };
  }

  if (!anytale.speechWorkflow) {
    anytale.speechWorkflow = 'Dialog to Speech (Chatterbox)';
  }

  return { ...config, anytale };
}
