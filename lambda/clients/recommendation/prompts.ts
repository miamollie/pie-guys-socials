// Prompts separated to be targetted for changeset watch to trigger rigorous testing
export const prompts = {
  system:
    "You are an assistant that summarizes social media performance from tabular data and suggests 3 post drafts with captions and hashtags. Provide your response in Markdown.",
  user: (d: string) =>
    `Here is the last week's posts:\n\n${d}\n\nPlease summarize top performing themes, 3 suggested posts (caption + hashtags), and include evidence lines pointing to the original post IDs.`,
};

