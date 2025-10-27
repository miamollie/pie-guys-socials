import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export class InstagramClient {
  // --- private Constants ---
  private static readonly SECRET_NAME = "INSTAGRAM_SECRET_KEY"; // Replace or inject via env
  private static readonly IG_BUSINESS_ID = process.env.IG_BUSINESS_ID; // Replace or inject via env
  private static readonly GRAPH_API_VERSION = "v16.0";
  private static readonly IG_BASE_URL = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;

  // --- Private fields ---
  private token: string | null = null;
  private readonly secretsClient: SecretsManagerClient;

  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || "eu-west-1",
    });
  }

  // --- Initialize client: fetch and cache IG access token ---
  private async initToken(): Promise<void> {
    if (this.token) return; // Already cached

    try {
      const result = await this.secretsClient.send(
        new GetSecretValueCommand({ SecretId: InstagramClient.SECRET_NAME })
      );
      if (!result.SecretString)
        throw new Error(`Secret ${InstagramClient.SECRET_NAME} has no value`);

      const parsed = JSON.parse(result.SecretString);
      this.token =
        parsed.access_token || parsed.current_access_token || parsed.key;

      if (!this.token)
        throw new Error(
          `No access token found in ${InstagramClient.SECRET_NAME}`
        );
    } catch (err) {
      console.error("❌ Failed to fetch IG token:", err);
      throw new Error("Could not initialize Instagram access token");
    }
  }

  // --- Core HTTP request wrapper ---
  private async request(url: string): Promise<any> {
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      console.error("❌ Instagram API error:", body);
      throw new Error(
        `Instagram API request failed: ${response.status} - ${response.statusText}`
      );
    }

    return response.json();
  }

  public async getInsights(days: number = 7): Promise<any> {
    await this.initToken();

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    const url = new URL(
      `${InstagramClient.IG_BASE_URL}/${InstagramClient.IG_BUSINESS_ID}/media`
    );
    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,timestamp,like_count,comments_count"
    );
    url.searchParams.set("since", since);
    url.searchParams.set("until", until);
    url.searchParams.set("access_token", this.token!);

    try {
      const data = await this.request(url.toString());
      console.log(`✅ IG insights fetched (${data.data?.length || 0} posts)`);
      return data;
    } catch (err) {
      console.error("❌ Error fetching IG insights:", err);
      throw err;
    }
  }
}
