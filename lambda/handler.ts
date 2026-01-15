import { createInstagramClient } from "./clients/insta";
import { RecommendationClient } from "./clients/recommendation";
import { createEmailClient } from "./clients/email";
import { createLLMClient } from "./clients/llmClient";
import { createLogger, timeOperation, logMetric, LambdaContext } from "./utils/logger";

const igClient = createInstagramClient();
const recsClient = new RecommendationClient(createLLMClient(), createEmailClient());

export const handler = async (event: any, context?: LambdaContext): Promise<any> => {
  const logger = createLogger(context);
  
  try {
    logger.info({ event }, "Starting weekly insights workflow");
    
    // Get IG insights
    const igInsights = await timeOperation(
      "fetch-instagram-insights",
      () => igClient.getInsights(),
      context
    );
    let postCount = 0;
    try {
      const insightsData = JSON.parse(igInsights);
      postCount = insightsData.data?.length || 0;
    } catch {
      // Ignore parse errors
    }
    logger.info({ postCount }, "Instagram insights retrieved");

    // Ask LLM for weekly analysis and suggestions
    const aiRecommendations = await timeOperation(
      "generate-ai-recommendations",
      () => recsClient.getRecommendation(igInsights),
      context
    );

    // Send email with recommendations
    await timeOperation(
      "send-email-recommendation",
      () => recsClient.sendRecommendation(aiRecommendations),
      context
    );
    
    // Log success metric
    logMetric("insights-workflow-success", 1);
    logger.info("Weekly insights workflow completed successfully");

    return { status: "ok" };
  } catch (err) {
    logger.error({ error: err }, "Handler error - insights workflow failed");
    logMetric("insights-workflow-error", 1);
    throw err;
  }
};
