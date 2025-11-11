import { InstagramClient } from "./clients/insta";
import { RecommendationClient } from "./clients/recommendation";

const igClient = new InstagramClient();
const recsClient = new RecommendationClient();

export const handler = async (): Promise<any> => {
  try {
    // Get IG insights
    const igInsights = await igClient.getInsights();
    console.log(igInsights);

    // Ask LLM for weekly analysis and suggestions
    const aiReccomendations = await recsClient.getRecommendation(
      JSON.stringify(igInsights)
    );

    // Send email with recommendations
    await recsClient.sendRecommendation(aiReccomendations);

    return { status: "ok" };
  } catch (err) {
    console.error("Handler error:", err);
    // Optionally send an error email or raise CloudWatch alarm
    throw err;
  }
};
