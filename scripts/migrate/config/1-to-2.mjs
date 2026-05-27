export const fromVersion = 1;
export const toVersion = 2;

export function migrate(config) {
  const anytale = config.anytale ?? {};

  if (!anytale.generateText) {
    anytale.generateText = {
      model: 'ssfdre38/gemma4-nano:latest',
      templates: {
        selfProfile: 'You are {{name}}, with the following personality profile: {{personality}}. Write a single sentence describing yourself on a dating profile, using the personality profile as a guide. Do not use more than 20 words.',
        voiceProfile: 'Write two lines of text as a description of the vocal characteristics of a character with the following personality profile: {{personality}}. \n\nUse the following example as a template:\nA female voice, clear and natural, moderate speed, stable tone, suitable for news broadcasting or daily conversation.\n\nALWAYS start the output with either "A female voice" or "A male voice". Output the vocal characteristics as prose ONLY.',
        outfitDescriptions: 'Write a short, one line description for an outfit named {{name}}, consisting of the following parts: {{parts}}. Do not use more than 20 words.',
      },
    };
  }

  return { ...config, anytale };
}
