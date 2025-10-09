import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  UpdateSecretVersionStageCommand,
  DescribeSecretCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Secrets Manager rotation Lambda for Instagram Graph long-lived tokens
 * Implements: createSecret, setSecret, testSecret, finishSecret
 */
export const handler = async (event: any) => {
  console.log("Rotation event:", JSON.stringify(event, null, 2));

  const secretId = event.SecretId;
  const token = event.ClientRequestToken;
  const step = event.Step;

  // --- Validation -----------------------------------------------------------
  const metadata = await client.send(
    new DescribeSecretCommand({ SecretId: secretId })
  );
  const versions = metadata.VersionIdsToStages || {};
  if (!(token in versions))
    throw new Error(`Secret version ${token} not found`);
  if (versions[token].includes("AWSCURRENT")) {
    console.log("Secret version already current — skipping rotation.");
    return;
  }
  if (!versions[token].includes("AWSPENDING")) {
    throw new Error(`Secret version ${token} not set as AWSPENDING`);
  }

  // --- Step Routing ---------------------------------------------------------
  switch (step) {
    case "createSecret":
      await createSecret(secretId, token);
      break;
    case "setSecret":
      await setSecret(secretId, token);
      break;
    case "testSecret":
      await testSecret(secretId, token);
      break;
    case "finishSecret":
      await finishSecret(secretId, token);
      break;
    default:
      throw new Error(`Invalid step parameter: ${step}`);
  }
};

// ---------------------------------------------------------------------------
// Step 1: Create new secret (refresh token)
// ---------------------------------------------------------------------------
async function createSecret(secretId: string, token: string) {
  console.log("🔄 Creating new secret version...");

  const currentSecret = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
      VersionStage: "AWSCURRENT",
    })
  );
  const { current_access_token } = JSON.parse(
    currentSecret.SecretString || "{}"
  );

  //todo move to env
  const refreshUrl = new URL(
    "https://graph.instagram.com/refresh_access_token"
  );
  refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
  refreshUrl.searchParams.set("access_token", current_access_token);

  const response = await fetch(refreshUrl.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh IG token: ${response.status} - ${text}`);
  }

  interface IGTOKEN {
    access_token: string;
    expires_in: number;
  }
  const data = (await response.json()) as IGTOKEN;
  console.log(`✅ Refreshed token valid for ${data.expires_in / 86400} days`);

  await client.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      ClientRequestToken: token,
      SecretString: JSON.stringify({
        access_token: data.access_token,
        expires_in: data.expires_in,
        refreshed_at: new Date().toISOString(),
      }),
      VersionStages: ["AWSPENDING"],
    })
  );
}

// ---------------------------------------------------------------------------
// Step 2: (Optional) Configure secret if needed
// ---------------------------------------------------------------------------
async function setSecret(secretId: string, token: string) {
  console.log(`SetSecret: No configuration required for ${secretId}`);
}

// ---------------------------------------------------------------------------
// Step 3: Test the new secret version
// ---------------------------------------------------------------------------
async function testSecret(secretId: string, token: string) {
  console.log(`🧪 Testing secret version for ${secretId}`);

  const pendingSecret = await client.send(
    new GetSecretValueCommand({ SecretId: secretId, VersionId: token })
  );
  const { access_token } = JSON.parse(pendingSecret.SecretString || "{}");

  const testUrl = new URL("https://graph.instagram.com/me");
  testUrl.searchParams.set("fields", "id");
  testUrl.searchParams.set("access_token", access_token);

  const response = await fetch(testUrl.toString());
  if (!response.ok)
    throw new Error(`Token test failed: ${response.statusText}`);

  const data = (await response.json()) as { id: string };
  if (!data.id) throw new Error("Token validation failed: no user ID");
  console.log(`✅ Token valid for Instagram user`);
}

// ---------------------------------------------------------------------------
// Step 4: Mark new version as AWSCURRENT
// ---------------------------------------------------------------------------
async function finishSecret(secretId: string, token: string) {
  console.log("🎉 Finishing rotation and promoting new version...");

  const describe = await client.send(
    new DescribeSecretCommand({ SecretId: secretId })
  );
  const currentVersion = Object.entries(describe.VersionIdsToStages || {}).find(
    ([, stages]) => (stages as string[]).includes("AWSCURRENT")
  )?.[0];

  await client.send(
    new UpdateSecretVersionStageCommand({
      SecretId: secretId,
      VersionStage: "AWSCURRENT",
      MoveToVersionId: token,
      RemoveFromVersionId: currentVersion,
    })
  );

  console.log(`✅ Rotation complete for ${secretId}`);
}
