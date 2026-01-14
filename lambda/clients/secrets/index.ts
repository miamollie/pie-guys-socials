import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";

export interface ISecretsClient {
  getSecretValue(secretId: string, versionStage?: string): Promise<string>;
  putSecretValue(secretId: string, token: string, value: any): Promise<void>;
  describeSecret(secretId: string): Promise<any>;
  promotePendingVersion(secretId: string, token: string): Promise<void>;
}

export class SecretsClient implements ISecretsClient {
  private client: SecretsManagerClient;

  constructor(region = process.env.AWS_REGION) {
    this.client = new SecretsManagerClient({ region });
  }

  // ---------------------------------------------------------------------------
  // Get current or specific secret value
  // ---------------------------------------------------------------------------
  async getSecretValue(secretId: string, versionStage = "AWSCURRENT") {
    const res = await this.client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionStage: versionStage,
      })
    );

    if (!res.SecretString) throw new Error(`Secret ${secretId} has no value`);

    const parsed = JSON.parse(res.SecretString);
    const value = parsed[secretId];

    if (!value)
      throw new Error(`Secret ${secretId} has no value in secret string`);

    return value;
  }

  // ---------------------------------------------------------------------------
  // Put a new secret value (e.g. during rotation)
  // ---------------------------------------------------------------------------
  async putSecretValue(secretId: string, token: string, value: any) {
    const data = {
      [secretId]: value,
    };
    await this.client.send(
      new PutSecretValueCommand({
        SecretId: secretId,
        ClientRequestToken: token,
        SecretString: JSON.stringify(data),
        VersionStages: ["AWSPENDING"],
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Describe a secret and get current version info
  // ---------------------------------------------------------------------------
  async describeSecret(secretId: string) {
    return this.client.send(new DescribeSecretCommand({ SecretId: secretId }));
  }

  // ---------------------------------------------------------------------------
  // Promote a pending version to current (finish rotation)
  // ---------------------------------------------------------------------------
  async promotePendingVersion(secretId: string, token: string) {
    console.log("🎉 Promoting pending secret version...");

    const describe = await this.describeSecret(secretId);
    const currentVersion = Object.entries(
      describe.VersionIdsToStages || {}
    ).find(([, stages]) => (stages as string[]).includes("AWSCURRENT"))?.[0];

    await this.client.send(
      new UpdateSecretVersionStageCommand({
        SecretId: secretId,
        VersionStage: "AWSCURRENT",
        MoveToVersionId: token,
        RemoveFromVersionId: currentVersion,
      })
    );

    console.log(`✅ Rotation complete for ${secretId}`);
  }
}

/**
 * Stubbed SecretsClient for testing without AWS Secrets Manager
 */
export class StubbedSecretsClient implements ISecretsClient {
  private secrets: Map<string, string> = new Map();

  constructor() {
    // Pre-populate with fake tokens
    this.secrets.set("INSTAGRAM_SECRET_KEY", "fake_instagram_token_12345");
    this.secrets.set("OPEN_AI_SECRET_KEY", "fake_openai_key_67890");
  }

  async getSecretValue(secretId: string, versionStage = "AWSCURRENT"): Promise<string> {
    console.log(`📋 [Stubbed] Getting secret: ${secretId} (stage: ${versionStage})`);
    const value = this.secrets.get(secretId);
    
    if (!value) {
      throw new Error(`[Stubbed] Secret ${secretId} not found`);
    }
    
    return value;
  }

  async putSecretValue(secretId: string, token: string, value: any): Promise<void> {
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    console.log(`📋 [Stubbed] Storing secret: ${secretId} (token: ${token}) = ${valueStr.substring(0, 20)}...`);
    this.secrets.set(secretId, valueStr);
  }

  async describeSecret(secretId: string): Promise<any> {
    console.log(`📋 [Stubbed] Describing secret: ${secretId}`);
    return {
      VersionIdsToStages: {
        "fake-version-id": ["AWSCURRENT"],
        "fake-pending-id": ["AWSPENDING"],
      },
    };
  }

  async promotePendingVersion(secretId: string, token: string): Promise<void> {
    console.log(`📋 [Stubbed] Promoting pending version for ${secretId} (token: ${token})`);
    console.log(`✅ [Stubbed] Rotation complete for ${secretId}`);
  }
}

/**
 * Factory function to create secrets client based on environment
 */
export function createSecretsClient(region?: string): ISecretsClient {
  const useStub = process.env.USE_STUB_SECRETS === "true";
  
  if (useStub) {
    console.log("📋 Using stubbed Secrets Manager client");
    return new StubbedSecretsClient();
  }
  
  console.log("🔐 Using real Secrets Manager client");
  return new SecretsClient(region);
}
