import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { StubbedEmailClient } from "./stubbed";

export interface IEmailClient {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void>;
}

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailClient implements IEmailClient {
  private readonly ses: SESClient;

  constructor() {
    this.ses = new SESClient({ region: process.env.region });
  }

  async send(message: EmailMessage): Promise<void> {
    if (!message.to || !message.from)
      throw new Error("Email must include both 'to' and 'from'");

    const e = new SendEmailCommand({
      Source: message.from,
      Destination: { ToAddresses: [message.to] },
      Message: {
        Subject: { Data: message.subject, Charset: "UTF-8" },
        Body: {
          ...(message.text
            ? { Text: { Data: message.text, Charset: "UTF-8" } }
            : {}),
          ...(message.html
            ? { Html: { Data: message.html, Charset: "UTF-8" } }
            : {}),
        },
      },
    });

    await this.ses.send(e);
  }
}

/**
 * Factory function to create Email client based on environment
 */
export function createEmailClient(): IEmailClient {
  const useStub = process.env.USE_STUB_EMAIL === "true";
  
  if (useStub) {
    console.log("📋 Using stubbed email client");
    return new StubbedEmailClient();
  }
  
  console.log("📧 Using real email client (SES)");
  return new EmailClient();
}
