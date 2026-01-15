import { data } from "./stubs";
import { IInstagramClient } from "./index";
import logger from "../../utils/logger";

/**
 * Stubbed Instagram client for testing without real API calls
 */
export class StubbedInstagramClient implements IInstagramClient {
  public async getInsights(days: number = 7): Promise<string> {
    logger.info({ days }, "Using stubbed Instagram insights");
    return data;
  }

  public async refreshToken(): Promise<{ access_token: string }> {
    logger.info("Stubbed token refresh - returning fake token");
    return {
      access_token: "FAKE_REFRESHED_TOKEN_" + Date.now(),
    };
  }

  public async testAccess(): Promise<void> {
    console.log("✅ Stubbed Instagram token validation - always succeeds");
  }
}
