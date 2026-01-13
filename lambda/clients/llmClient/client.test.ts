import { LLMClient } from "./index";
import OpenAI from "openai";
import { SecretsClient } from "../secrets";

// Mock dependencies
jest.mock("openai");
jest.mock("../secrets");

describe("LLMClient", () => {
  const mockKey = "fake-openai-key";
  const mockResponse = {
    output_text: "Recommended posts",
  };

  beforeEach(() => {
    jest.resetAllMocks();

    (SecretsClient as jest.Mock).mockImplementation(() => ({
      getSecretValue: jest.fn().mockResolvedValue(mockKey),
    }));

    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: {
        create: jest.fn().mockResolvedValue(mockResponse),
      },
    }));
  });

  it("Calls responses API", async () => {
    const client = new LLMClient();
    const result = await client.get({
      system: "You are a social media summarizer",
      prompt: "Analyze the last week's posts",
    });

    expect(result).toBe("Recommended posts");
  });

  it("throws if no secret is found", async () => {
    (SecretsClient as jest.Mock).mockImplementation(() => ({
      getSecretValue: jest.fn().mockResolvedValue(null),
    }));

    const client = new LLMClient();
    await expect(
      client.get({ system: "test", prompt: "test" })
    ).rejects.toThrow("Could not initialize LLMClient");
  });

  it("throws if OpenAI response has no output_text", async () => {
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: {
        create: jest.fn().mockResolvedValue({}),
      },
    }));

    const client = new LLMClient();
    await expect(
      client.get({ system: "test", prompt: "test" })
    ).rejects.toThrow("OpenAI request failed: no recommendation returned");
  });
});
