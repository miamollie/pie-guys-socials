import { createInstagramClient } from "./clients/insta";
import { RecommendationClient } from "./clients/recommendation";
import { createEmailClient } from "./clients/email";
import { createLLMClient } from "./clients/llmClient";

const igClient = createInstagramClient();
const recsClient = new RecommendationClient(createLLMClient(), createEmailClient());

export const handler = async (): Promise<any> => {
  try {
    // Get IG insights
    const igInsights = await igClient.getInsights();
    // console.log(igInsights);

    // Ask LLM for weekly analysis and suggestions
    const aiRecommendations = await recsClient.getRecommendation(igInsights);

    // Send email with recommendations
    await recsClient.sendRecommendation(aiRecommendations);

    return { status: "ok" };
  } catch (err) {
    console.error("Handler error:", err);
    // Optionally send an error email or raise CloudWatch alarm
    throw err;
  }
};
