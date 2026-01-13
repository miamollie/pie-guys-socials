/**
 * Test to verify stub mode functionality
 */

import { createInstagramClient } from "../lambda/clients/insta";
import { createEmailClient } from "../lambda/clients/email";
import { createLLMClient } from "../lambda/clients/llmClient";

describe("Stub Mode", () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.USE_STUB_IG;
    delete process.env.USE_STUB_EMAIL;
    delete process.env.USE_STUB_LLM;
  });

  describe("Instagram Client Factory", () => {
    it("creates stubbed client when USE_STUB_IG=true", async () => {
      process.env.USE_STUB_IG = "true";
      const client = createInstagramClient();
      
      const result = await client.getInsights();
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("creates real client when USE_STUB_IG=false", () => {
      process.env.USE_STUB_IG = "false";
      const client = createInstagramClient();
      
      expect(client).toBeDefined();
      expect(client.getInsights).toBeDefined();
    });
  });

  describe("Email Client Factory", () => {
    it("creates stubbed client when USE_STUB_EMAIL=true", async () => {
      process.env.USE_STUB_EMAIL = "true";
      const client = createEmailClient();
      
      // Should not throw
      await expect(
        client.send({
          to: "test@example.com",
          from: "sender@example.com",
          subject: "Test",
          text: "Test body",
        })
      ).resolves.not.toThrow();
    });

    it("creates real client when USE_STUB_EMAIL=false", () => {
      process.env.USE_STUB_EMAIL = "false";
      const client = createEmailClient();
      
      expect(client).toBeDefined();
      expect(client.send).toBeDefined();
    });
  });

  describe("LLM Client Factory", () => {
    it("creates stubbed client when USE_STUB_LLM=true", async () => {
      process.env.USE_STUB_LLM = "true";
      const client = createLLMClient();
      
      const result = await client.get({
        system: "Test system",
        prompt: "Test prompt",
      });
      
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("creates real client when USE_STUB_LLM=false", () => {
      process.env.USE_STUB_LLM = "false";
      const client = createLLMClient();
      
      expect(client).toBeDefined();
      expect(client.get).toBeDefined();
    });
  });
});
