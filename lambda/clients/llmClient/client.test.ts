import { LLMClient } from "./index";
import OpenAI from "openai";
import { createSecretsClient } from "../secrets";

// Mock dependencies
jest.mock("openai");

const mockSecretsClient = {
  getSecretValue: jest.fn(),
  putSecretValue: jest.fn(),
  describeSecret: jest.fn(),
  promotePendingVersion: jest.fn(),
};

jest.mock("../secrets", () => ({
  createSecretsClient: jest.fn(() => mockSecretsClient),
}));

describe("LLMClient", () => {
  const mockKey = "fake-openai-key";
  const mockResponse = {
    output_text: "Recommended posts",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsClient.getSecretValue.mockResolvedValue(mockKey);

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
    mockSecretsClient.getSecretValue.mockResolvedValue("");

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
