import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import fetch from "node-fetch";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import OpenAI from "openai";

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
});
const sesClient = new SESClient({ region: process.env.AWS_REGION });

async function getSecretValue(name: string): Promise<string> {
  const resp = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: name })
  );
  if (!resp.SecretString) throw new Error(`Secret ${name} missing`);
  return resp.SecretString;
}

const igTokenSecretName = process.env.IG_TOKEN_SECRET_NAME!;
const igBusinessId = process.env.IG_BUSINESS_ID || "YOUR_IG_BUSINESS_ID";
const toEmail = process.env.TO_EMAIL!;
const fromEmail = process.env.FROM_EMAIL!;

export const handler = async (event: any = {}): Promise<any> => {
  console.log("Event:", JSON.stringify(event).slice(0, 200));

  try {
    // Get IG insights
    const igInsights = await getIGInsights();

    // Ask LLM for weekly analysis and suggestions
    const aiReccomendations = await getRecommendation(
      JSON.stringify(igInsights)
    );

    // Send email with recommendations
    await sendEmail(aiReccomendations);

    return { status: "ok" };
  } catch (err) {
    console.error("Handler error:", err);
    // Optionally send an error email or raise CloudWatch alarm
    throw err;
  }
};

async function getIGInsights(): Promise<JSON> {
  const key = await getSecretValue(igTokenSecretName);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const igUrl = `https://graph.facebook.com/v16.0/${igBusinessId}/media?fields=id,caption,media_type,media_url,timestamp,like_count,comments_count&since=${since}&until=${until}&access_token=${encodeURIComponent(
    key
  )}`;

  const igResp = await fetch(igUrl);
  const igJson = await igResp.json();
  console.log("IG fetch result:", JSON.stringify(igJson).slice(0, 500));
  return igJson as JSON;
}

async function getRecommendation(igInsights: string) {
  const apiKey = await getSecretValue(process.env.OPEN_AI_SECRET_NAME!);
  const openAIClient = new OpenAI({ apiKey });
  const r = await openAIClient.responses.create({
    model: "gpt-4o",
    instructions:
      "You are an assistant that summarizes social media performance from tabular data and suggests 3 post drafts with captions and hashtags.",
    input: `Here is the last week's posts:\n\n${JSON.stringify(
      igInsights || [],
      null,
      2
    )}\n\nPlease summarize top performing themes, 3 suggested posts (caption + hashtags), and include the evidence lines pointing to the original post IDs.`,
  });

  return r.output_text;
}

async function sendEmail(aiReccomendations: string) {
  // 5) Compose Markdown email
  const markdown = `# Weekly Social Summary\n\n${aiReccomendations}\n\n---\n*Generated: ${new Date().toISOString()}*`;

  // 6) Send email via SES
  const subject = "Weekly social summary & suggested drafts — Pie Guys";

  const sendCmd = new SendEmailCommand({
    Source: fromEmail, //The email address that is sending the email
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: markdown,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
  });
  await sesClient.send(sendCmd);
  console.log("Email sent.");
}
