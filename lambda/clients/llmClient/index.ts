import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface LLMInput {
  system: string;
  prompt: string;
}

export class LLMClient {
  // --- Private fields ---
  private readonly secretsClient: SecretsManagerClient;
  private openAIClient: OpenAI;
  private apiKey: string | null = null;
  private model: "gpt-4";
  private SECRET_NAME: "OPEN_AI_SECRET_KEY";

  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || "eu-west-1",
    });
  }

  private async initClient() {
    if (this.openAIClient) return; // Already cached

    try {
      const result = await this.secretsClient.send(
        new GetSecretValueCommand({ SecretId: this.SECRET_NAME })
      );
      if (!result.SecretString)
        throw new Error(`Secret ${this.SECRET_NAME} has no value`);

      const parsed = JSON.parse(result.SecretString);
      this.apiKey = parsed.api_key || parsed.key || parsed.OPENAI_API_KEY;

      if (!this.apiKey)
        throw new Error(`No OpenAI API key found in ${this.SECRET_NAME}`);

      this.openAIClient = new OpenAI({ apiKey: this.apiKey });
    } catch (err) {
      console.error("❌ Failed to initialize OpenAI client:", err);
      throw new Error("Could not initialize RecommendationClient");
    }
  }

  async get(input: LLMInput) {
    this.initClient();

    try {
      const response = await this.openAIClient.responses.create({
        model: this.model,
        instructions: input.system,
        input: input.prompt,
      });

      if ((response as any).error) {
        const msg = (response as any).error.message;
        throw new Error(`OpenAI request failed: ${msg}`);
      }

      if (!response.output_text)
        throw new Error(`OpenAI request failed: no recommendation returned`);

      return response.output_text;
    } catch (err) {
      console.error("❌ Error generating recommendations:", err);
      throw err;
    }
  }
}
