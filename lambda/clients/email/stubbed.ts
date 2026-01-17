import { EmailMessage, IEmailClient } from "./index";

/**
 * Stubbed email client for testing without sending real emails
 */
export class StubbedEmailClient implements IEmailClient {
  async send(message: EmailMessage): Promise<void> {
    if (!message.to?.trim() || !message.from?.trim()) {
      throw new Error(`Email must include both 'to' and 'from'. Got: to='${message.to}', from='${message.from}'`);
    }

    console.log("📧 Stubbed email send:");
    console.log(`  From: ${message.from}`);
    console.log(`  To: ${message.to}`);
    console.log(`  Subject: ${message.subject}`);
    console.log(`  Body preview: ${(message.text || message.html || "").slice(0, 100)}...`);
    console.log("  ✅ Email logged (not actually sent)");
  }
}
