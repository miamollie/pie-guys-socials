/**
 * Common interfaces for client implementations (real and stubbed)
 */

export interface IInstagramClient {
  getInsights(days?: number): Promise<string>;
  refreshToken?(): Promise<{ access_token: string }>;
  testAccess?(): Promise<void>;
}

export interface IEmailClient {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void>;
}

export interface ILLMClient {
  get(input: { system: string; prompt: string }): Promise<string>;
}
