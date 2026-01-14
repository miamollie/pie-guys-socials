import { InstagramClient } from "./";
import { SecretsClient } from "../secrets";
import { data as stubData } from "./stubs";

// ---- Mock SecretsClient ----
jest.mock("../secrets", () => {
  return {
    SecretsClient: jest.fn().mockImplementation(() => ({
      getSecretValue: jest.fn(),
    })),
  };
});

// ---- Mock fetch ----
global.fetch = jest.fn();

const mockSecretsInstance = new SecretsClient() as jest.Mocked<SecretsClient>;

describe("InstagramClient", () => {
  let client: InstagramClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new InstagramClient();

    // @ts-ignore private field override
    client["secretsClient"] = mockSecretsInstance;

    // default mock secret
    mockSecretsInstance.getSecretValue.mockResolvedValue("TEST_TOKEN");
  });

  test("initToken loads token once", async () => {
    await (client as any).initToken();
    expect(mockSecretsInstance.getSecretValue).toHaveBeenCalledTimes(1);

    // second call should not refetch
    await (client as any).initToken();
    expect(mockSecretsInstance.getSecretValue).toHaveBeenCalledTimes(1);
  });

  test("initToken throws if secret missing", async () => {
    mockSecretsInstance.getSecretValue.mockResolvedValueOnce(null);

    await expect((client as any).initToken()).rejects.toThrow(
      "Could not initialize Instagram access token"
    );
  });

  test("request returns JSON on success", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    const result = await (client as any).request("http://example.com");
    expect(result).toEqual({ message: "ok" });
  });

  test("request throws error on non-200", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => "Error details",
    });

    await expect((client as any).request("x")).rejects.toThrow(
      "Instagram API request failed: 400 - Bad Request"
    );
  });

  test("getInsights returns stringified JSON", async () => {
    mockSecretsInstance.getSecretValue.mockResolvedValue("REAL_TOKEN");

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "1" }] }),
    });

    const result = await client.getInsights(7);

    expect(typeof result).toBe("string");
    expect(JSON.parse(result)).toEqual({ data: [{ id: "1" }] });
  });

  test("getInsights throws on fetch error", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => "Invalid token",
    });

    await expect(client.getInsights()).rejects.toThrow(
      "Instagram API request failed: 403 - Forbidden"
    );
  });

  // ---------------------------------------
  test("refreshToken updates token and returns data", async () => {
    const fakeRefresh = {
      access_token: "NEW_TOKEN",
      expires_in: 86400,
    };

    mockSecretsInstance.getSecretValue.mockResolvedValue("OLD_TOKEN");

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => fakeRefresh,
    });

    const res = await client.refreshToken();
    expect(res).toEqual(fakeRefresh);

    expect(client["token"]).toEqual("NEW_TOKEN");
  });

  test("refreshToken throws on error", async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal",
    });

    await expect(client.refreshToken()).rejects.toThrow(
      "Failed to refresh IG token: 500 - Internal"
    );
  });

  test("testAccess succeeds when /me returns id", async () => {
    mockSecretsInstance.getSecretValue.mockResolvedValue("TOKEN");

    // Must initialize token first
    await (client as any).initToken();

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "123" }),
    });

    await expect(client.testAccess()).resolves.not.toThrow();
  });

  test("testAccess throws if response not ok", async () => {
    mockSecretsInstance.getSecretValue.mockResolvedValue("TOKEN");
    await (client as any).initToken();

    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Bad token",
    });

    await expect(client.testAccess()).rejects.toThrow("Token test failed:");
  });

  test("testAccess throws if id missing", async () => {
    mockSecretsInstance.getSecretValue.mockResolvedValue("TOKEN");
    await (client as any).initToken();

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(client.testAccess()).rejects.toThrow(
      "Token validation failed: missing or null user ID"
    );
  });
});
