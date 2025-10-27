import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { EmailClient } from "../email";
import { prompts } from "./prompts";
import { LLMClient } from "../llmClient";

export class RecommendationClient {
  // --- Private fields ---
  private readonly secretsClient: SecretsManagerClient;
  private readonly emailClient: EmailClient;
  private LLMClient: LLMClient;

  // --- Constructor ---
  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || "eu-west-1",
    });
    this.LLMClient = new LLMClient();
    this.emailClient = new EmailClient();
  }

  public async getRecommendation(igInsights: any): Promise<string> {
    const insightsJson = JSON.stringify(igInsights || [], null, 2);

    return await this.LLMClient.get({
      system: prompts.system,
      prompt: prompts.user(insightsJson),
    });
  }

  public async sendRecommendation(r: string) {
    const date = new Date().toISOString();
    const text = `
    # Weekly Social Summary
    
    ${r}
    
    ---
    
    *Generated: ${date}*
     `;
    await this.emailClient.send({
      to: process.env.TO_EMAIL!,
      from: process.env.FROM_EMAIL!,
      subject: "Weekly Social Summary — Pie Guys",
      text,
    });
  }
}
