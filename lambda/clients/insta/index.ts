import { createSecretsClient, ISecretsClient } from "../secrets";
import { data } from "./stubs";
import { StubbedInstagramClient } from "./stubbed";
import logger from "../../utils/logger";

export interface IInstagramClient {
  getInsights(days?: number): Promise<string>;
  refreshToken?(): Promise<{ access_token: string }>;
  testAccess?(): Promise<void>;
}

export class InstagramClient implements IInstagramClient {
  private static readonly SECRET_NAME =
    process.env.IG_SECRET_NAME || "INSTAGRAM_SECRET_KEY";
  private static readonly IG_BUSINESS_ID = process.env.IG_BUSINESS_ID;
  private static readonly GRAPH_API_VERSION = "v23.0";
  private static readonly IG_BASE_URL = `https://graph.facebook.com/${this.GRAPH_API_VERSION}`;

  private token: string | null = null;
  private readonly secretsClient: ISecretsClient;

  constructor() {
    this.secretsClient = createSecretsClient();
  }

  // --- Initialize client: fetch and cache IG access token ---
  // could be stale if token is rotated while lambda is hot
  // but that's fine because the invocations rate is so slow, these lambdas will always cold start
  private async initToken(): Promise<void> {
    if (this.token) return; // Already cached

    try {
      const token = await this.secretsClient.getSecretValue(
        InstagramClient.SECRET_NAME
      );

      if (!token)
        throw new Error(
          `No access token found in ${InstagramClient.SECRET_NAME}`
        );

      this.token = token;
    } catch (err) {
      logger.error({ error: err, secretName: InstagramClient.SECRET_NAME }, "Failed to fetch IG token from secrets");
      throw new Error("Could not initialize Instagram access token");
    }
  }

  // --- Core HTTP request wrapper ---
  private async request(url: string): Promise<any> {
    const response = await fetch(url);

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, statusText: response.statusText, body }, "Instagram API request failed");
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

    // first get the most recent media
    // then get insights for those media IDs
    // in future, also compare profile ID insights result variation over time (have the account level insights improved or not)

    try {
      const data = await this.request(url.toString());
      logger.info({ postCount: data.data?.length || 0, days, since, until }, "Instagram insights fetched");
      return JSON.stringify(data);
    } catch (err) {
      logger.error({ error: err, days, since, until }, "Error fetching Instagram insights");
      throw err;
    }
  }

  public async refreshToken(): Promise<{
    access_token: string;
  }> {
    await this.initToken();

    const refreshUrl = new URL(
      `${InstagramClient.IG_BASE_URL}/refresh_access_token`
    );
    refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
    refreshUrl.searchParams.set("access_token", this.token!); // init token ensures not null

    const response = await fetch(refreshUrl.toString());
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to refresh IG token: ${response.status} - ${text}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    const validDays = Math.floor(data.expires_in / 86400);
    logger.info({ validDays, expiresIn: data.expires_in }, \"Instagram token refreshed\");

    // Update cached token with refreshed value
    this.token = data.access_token;
    return data;
  }

  async testAccess(): Promise<void> {
    const testUrl = new URL(`${InstagramClient.IG_BASE_URL}/me`);
    testUrl.searchParams.set("fields", "id");
    testUrl.searchParams.set("access_token", this.token!);

    const response = await fetch(testUrl.toString());

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Token test failed: ${response.status} ${response.statusText} - ${errText}`
      );
    }

    const data = (await response.json()) as { id?: string };

    if (!data.id) {
      throw new Error("Token validation failed: missing or null user ID");
    }

    logger.info({ userId: data.id }, "Instagram token validated successfully");
  }
}

/**
 * Factory function to create Instagram client based on environment
 */
export function createInstagramClient(): IInstagramClient {
  const useStub = process.env.USE_STUB_IG === "true";
  
  if (useStub) {
    logger.info("Using stubbed Instagram client");
    return new StubbedInstagramClient();
  }
  
  logger.info("Using real Instagram client");
  return new InstagramClient();
}
