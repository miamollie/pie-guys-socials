import OpenAI from "openai";
import { SecretsClient } from "../secrets";

interface LLMInput {
  system: string;
  prompt: string;
}

export class LLMClient {
  // --- Private fields ---
  private readonly secretsClient: SecretsClient;
  private openAIClient: OpenAI;
  private static readonly model = "gpt-4" as const;
  private static readonly SECRET_NAME =
    (process.env.OPEN_AI_SECRET_NAME as const) || ("OPEN_AI_SECRET_KEY" as const);

  constructor() {
    this.secretsClient = new SecretsClient();
  }

  private async initClient() {
    if (this.openAIClient) return; // Already cached

    try {
      const key = await this.secretsClient.getSecretValue(
        LLMClient.SECRET_NAME
      );

      if (!key)
        throw new Error(`No OpenAI API key found in ${LLMClient.SECRET_NAME}`);

      this.openAIClient = new OpenAI({ apiKey: key });
    } catch (err) {
      console.error("❌ Failed to initialize OpenAI client:", err);
      throw new Error("Could not initialize LLMClient");
    }
  }

  async get(input: LLMInput) {
    await this.initClient();

    try {
      const response = await this.openAIClient.responses.create({
        model: LLMClient.model,
        instructions: input.system,
        input: input.prompt,
      });

      if ((response as any).error) {
        const msg = (response as any).error.message;
        throw new Error(`OpenAI request failed: ${msg}`);
      }

      if (!response.output_text.length)
        throw new Error(`OpenAI request failed: no recommendation returned`);

      return response.output_text;
    } catch (err) {
      console.error("❌ Error generating recommendations:", err);
      throw err;
    }
  }
}
