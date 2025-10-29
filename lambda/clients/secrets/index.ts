import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";

export class SecretsClient {
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
