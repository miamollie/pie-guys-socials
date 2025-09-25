import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import fetch from "node-fetch";

const secrets = new SecretsManagerClient({ region: "eu-west-1" });

export const handler = async () => {
  try {
    // 1. Fetch existing token from Secrets Manager
    const secretName = process.env.IG_SECRET_NAME!;
    const { SecretString } = await secrets.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    if (!SecretString) throw new Error("No token found in Secrets Manager");

    const { access_token } = JSON.parse(SecretString);

    // 2. Refresh the token via Graph API
    const appId = process.env.FB_APP_ID!;
    const appSecret = process.env.FB_APP_SECRET!;

    const url =
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${appId}` +
      `&client_secret=${appSecret}` +
      `&fb_exchange_token=${access_token}`;

    const res = await fetch(url);
    const data = await res.json();

    // @ts-ignore
    if (!data.access_token) {
      throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
    }

    // @ts-ignore
    const newToken = data.access_token;

    // 3. Store new token back in Secrets Manager
    await secrets.send(
      new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: JSON.stringify({ access_token: newToken }),
      })
    );

    console.log("Successfully refreshed IG token");
    return { status: "ok", newTokenPreview: newToken.slice(0, 10) + "..." };
  } catch (err) {
    console.error("Error refreshing IG token:", err);
    throw err;
  }
};
