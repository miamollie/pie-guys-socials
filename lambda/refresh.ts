import { createInstagramClient } from "./clients/insta";
import { createSecretsClient } from "./clients/secrets";

const secretclient = createSecretsClient();
const igclient = createInstagramClient();

/**
 * Secrets Manager rotation Lambda for Instagram Graph long-lived tokens
 * Implements: createSecret, setSecret, testSecret, finishSecret
 */
export const handler = async (event: any) => {
  console.log("Rotation event:", JSON.stringify(event, null, 2));

  const secretId = event.SecretId;
  const token = event.ClientRequestToken;
  const step = event.Step;

  // todo figure out validation
  // // --- Validation -----------------------------------------------------------
  // const metadata = await client.send(
  //   new DescribeSecretCommand({ SecretId: secretId })
  // );
  // const versions = metadata.VersionIdsToStages || {};
  // if (!(token in versions))
  //   throw new Error(`Secret version ${token} not found`);
  // if (versions[token].includes("AWSCURRENT")) {
  //   console.log("Secret version already current — skipping rotation.");
  //   return;
  // }
  // if (!versions[token].includes("AWSPENDING")) {
  //   throw new Error(`Secret version ${token} not set as AWSPENDING`);
  // }

  // --- Step Routing ---------------------------------------------------------
  switch (step) {
    case "createSecret":
      await createSecret(secretId, token);
      break;
    case "setSecret":
      await setSecret(secretId);
      break;
    case "testSecret":
      await testSecret(secretId);
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
  if (!igclient.refreshToken) {
    throw new Error("refreshToken method not available on client");
  }
  const data = await igclient.refreshToken();
  await secretclient.putSecretValue(secretId, token, data);
}

// ---------------------------------------------------------------------------
// Step 2: (Optional) Configure secret if needed
// ---------------------------------------------------------------------------
async function setSecret(secretId: string) {
  console.log(`SetSecret: No configuration required for ${secretId}`);
}

// ---------------------------------------------------------------------------
// Step 3: Test the new secret version
// ---------------------------------------------------------------------------
async function testSecret(secretId: string) {
  console.log(`🧪 Testing secret version for ${secretId}`);

  if (!igclient.testAccess) {
    throw new Error("testAccess method not available on client");
  }
  await igclient.testAccess();

  console.log(`✅ Token valid for Instagram user`);
}

// ---------------------------------------------------------------------------
// Step 4: Mark new version as AWSCURRENT
// ---------------------------------------------------------------------------
async function finishSecret(secretId: string, token: string) {
  console.log("🎉 Finishing rotation and promoting new version...");

  await secretclient.promotePendingVersion(secretId, token);

  console.log(`✅ Rotation complete for ${secretId}`);
}
