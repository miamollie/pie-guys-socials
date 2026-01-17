import { createInstagramClient } from "./clients/insta";
import { createSecretsClient } from "./clients/secrets";
import { createLogger, logMetric, LambdaContext } from "./utils/logger";

const secretclient = createSecretsClient();
const igclient = createInstagramClient();

/**
 * Secrets Manager rotation Lambda for Instagram Graph long-lived tokens
 * Implements: createSecret, setSecret, testSecret, finishSecret
 */
export const handler = async (event: any, context?: LambdaContext) => {
  const logger = createLogger(context);
  logger.info({ event }, "Starting secret rotation");

  const secretId = event.SecretId;
  const token = event.ClientRequestToken;
  const step = event.Step;

  try {
    // --- Step Routing ---------------------------------------------------------
    switch (step) {
      case "createSecret":
        await createSecret(secretId, token, logger);
        break;
      case "setSecret":
        await setSecret(secretId, logger);
        break;
      case "testSecret":
        await testSecret(secretId, logger);
        break;
      case "finishSecret":
        await finishSecret(secretId, token, logger);
        break;
      default:
        throw new Error(`Invalid step parameter: ${step}`);
    }
    
    logMetric("secret-rotation-success", 1, "Count", { step, secretId });
    logger.info({ step, secretId }, "Secret rotation step completed");
  } catch (error) {
    logger.error({ error, step, secretId }, "Secret rotation failed");
    logMetric("secret-rotation-error", 1, "Count", { step, secretId });
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Step 1: Create new secret (refresh token)
// ---------------------------------------------------------------------------
async function createSecret(secretId: string, token: string, logger: any) {
  if (!igclient.refreshToken) {
    throw new Error("refreshToken method not available on client");
  }
  logger.info({ secretId }, "Creating new secret version");
  const data = await igclient.refreshToken();
  await secretclient.putSecretValue(secretId, token, data);
  logger.info({ secretId, token }, "New secret version created");
}

// ---------------------------------------------------------------------------
// Step 2: (Optional) Configure secret if needed
// ---------------------------------------------------------------------------
async function setSecret(secretId: string, logger: any) {
  logger.info({ secretId }, "SetSecret: No configuration required");
}

// ---------------------------------------------------------------------------
// Step 3: Test the new secret version
// ---------------------------------------------------------------------------
async function testSecret(secretId: string, logger: any) {
  logger.info({ secretId }, "Testing new secret version");

  if (!igclient.testAccess) {
    throw new Error("testAccess method not available on client");
  }
  await igclient.testAccess();

  logger.info({ secretId }, "Token validation successful");
}

// ---------------------------------------------------------------------------
// Step 4: Mark new version as AWSCURRENT
// ---------------------------------------------------------------------------
async function finishSecret(secretId: string, token: string, logger: any) {
  logger.info({ secretId, token }, "Finishing rotation and promoting new version");

  await secretclient.promotePendingVersion(secretId, token);

  logger.info({ secretId }, "Rotation complete - new version promoted to AWSCURRENT");
}
