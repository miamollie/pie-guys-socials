import { prompts } from "./prompts";
import { ILLMClient, IEmailClient } from "../interfaces";

export class RecommendationClient {
  // --- Private fields ---
  private readonly emailClient: IEmailClient;
  private readonly llmClient: ILLMClient;

  // --- Constructor ---
  constructor(llm: ILLMClient, email: IEmailClient) {
    this.llmClient = llm;
    this.emailClient = email;
  }

  public async getRecommendation(igInsights: any): Promise<string> {
    const insightsJson = JSON.stringify(igInsights || [], null, 2);

    return await this.llmClient.get({
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
