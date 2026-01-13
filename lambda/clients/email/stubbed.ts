import { EmailMessage } from "./index";
import { IEmailClient } from "../interfaces";

/**
 * Stubbed email client for testing without sending real emails
 */
export class StubbedEmailClient implements IEmailClient {
  async send(message: EmailMessage): Promise<void> {
    if (!message.to || !message.from) {
      throw new Error("Email must include both 'to' and 'from'");
    }

    console.log("📧 Stubbed email send:");
    console.log(`  From: ${message.from}`);
    console.log(`  To: ${message.to}`);
    console.log(`  Subject: ${message.subject}`);
    console.log(`  Body preview: ${(message.text || message.html || "").slice(0, 100)}...`);
    console.log("  ✅ Email logged (not actually sent)");
  }
}
