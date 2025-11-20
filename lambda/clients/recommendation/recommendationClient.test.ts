import { RecommendationClient } from "./";
import { EmailClient } from "../email";
import { LLMClient } from "../llmClient";
import { prompts } from "./prompts";

// ---- Mock LLMClient & EmailClient ----
jest.mock("../llmClient", () => {
  return {
    LLMClient: jest.fn().mockImplementation(() => ({
      get: jest.fn(),
    })),
  };
});

jest.mock("../email", () => {
  return {
    EmailClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  };
});

describe("RecommendationClient", () => {
  let llmMock: jest.Mocked<LLMClient>;
  let emailMock: jest.Mocked<EmailClient>;
  let client: RecommendationClient;

  beforeEach(() => {
    llmMock = new LLMClient() as jest.Mocked<LLMClient>;
    emailMock = new EmailClient() as jest.Mocked<EmailClient>;
    client = new RecommendationClient(llmMock, emailMock);
  });

  // ---------------------------------------------------
  // getRecommendation
  // ---------------------------------------------------
  test("getRecommendation calls LLMClient.get with formatted insights", async () => {
    const fakeInsights = [{ id: "1", likes: 10 }];
    const expectedJson = JSON.stringify(fakeInsights, null, 2);
    const fakeResponse = "This is your recommendation.";

    llmMock.get.mockResolvedValue(fakeResponse);

    const result = await client.getRecommendation(fakeInsights);

    // Validate LLM call
    expect(llmMock.get).toHaveBeenCalledTimes(1);

    const callArg = llmMock.get.mock.calls[0][0];
    expect(callArg.system).toBe(prompts.system);
    expect(callArg.prompt).toBe(prompts.user(expectedJson));

    expect(result).toBe(fakeResponse);
  });

  test("getRecommendation handles null insights safely", async () => {
    llmMock.get.mockResolvedValue("ok");

    await client.getRecommendation(null);

    const arg = llmMock.get.mock.calls[0][0];
    const expectedEmpty = JSON.stringify([], null, 2);

    expect(arg.prompt).toBe(prompts.user(expectedEmpty));
  });

  // ---------------------------------------------------
  // sendRecommendation
  // ---------------------------------------------------
  test("sendRecommendation sends formatted email", async () => {
    process.env.TO_EMAIL = "to@test.com";
    process.env.FROM_EMAIL = "from@test.com";

    const text = "Your weekly recommendation!";

    await client.sendRecommendation(text);

    expect(emailMock.send).toHaveBeenCalledTimes(1);

    const call = emailMock.send.mock.calls[0][0];

    expect(call.to).toBe("to@test.com");
    expect(call.from).toBe("from@test.com");
    expect(call.subject).toBe("Weekly Social Summary — Pie Guys");

    // Email body formatting
    expect(call.text).toContain("# Weekly Social Summary");
    expect(call.text).toContain(text);
    expect(call.text).toContain("Generated:");
  });
});
