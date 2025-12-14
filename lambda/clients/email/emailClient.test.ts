import { EmailClient } from "./";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

jest.mock("@aws-sdk/client-ses", () => {
  return {
    SESClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    SendEmailCommand: jest.fn() as unknown as jest.Mock,
  };
});

describe("EmailClient", () => {
  let client: EmailClient;
  let sesMock: jest.Mocked<SESClient>;

  beforeEach(() => {
    process.env.region = "us-east-1";

    sesMock = new SESClient() as jest.Mocked<SESClient>;
    client = new EmailClient();

    // ensure we reference the same mocked instance
    (client as any).ses = sesMock;
  });

  test("throws if missing to/from", async () => {
    await expect(
      client.send({ to: "x@test.com", subject: "hi", from: "" } as any)
    ).rejects.toThrow("Email must include both 'to' and 'from'");
  });

  test("sends email with correct parameters (text only)", async () => {
    const message = {
      to: "to@test.com",
      from: "from@test.com",
      subject: "Hello",
      text: "This is text",
    };

    await client.send(message);

    expect(SendEmailCommand).toHaveBeenCalledTimes(1);

    expect(SendEmailCommand).toHaveBeenCalledWith({
      Source: "from@test.com",
      Destination: { ToAddresses: ["to@test.com"] },
      Message: {
        Subject: { Data: "Hello", Charset: "UTF-8" },
        Body: {
          Text: { Data: "This is text", Charset: "UTF-8" },
        },
      },
    });

    expect(sesMock.send).toHaveBeenCalledTimes(1);
  });

  test("sends email with HTML body", async () => {
    const message = {
      to: "to@test.com",
      from: "from@test.com",
      subject: "Hello",
      html: "<p>Welcome</p>",
    };

    await client.send(message);

    expect(SendEmailCommand).toHaveBeenCalledWith({
      Source: "from@test.com",
      Destination: { ToAddresses: ["to@test.com"] },
      Message: {
        Subject: { Data: "Hello", Charset: "UTF-8" },
        Body: {
          Html: { Data: "<p>Welcome</p>", Charset: "UTF-8" },
        },
      },
    });
  });
});
