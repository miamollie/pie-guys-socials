import { handler } from "../lambda/refresh";
import { readFileSync } from "fs";
import { mockClient } from "aws-sdk-client-mock";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";

// --- Mock AWS SDK ---------------------------------------------------------
const secretsMock = mockClient(SecretsManagerClient);

secretsMock.on(DescribeSecretCommand).resolves({
  VersionIdsToStages: {
    "11111111-2222-3333-4444-555555555555": ["AWSPENDING"],
    "99999999-8888-7777-6666-555555555555": ["AWSCURRENT"],
  },
});

secretsMock.on(GetSecretValueCommand, { VersionStage: "AWSCURRENT" }).resolves({
  SecretString: JSON.stringify({
    current_access_token: "old_token_value",
  }),
});

secretsMock.on(PutSecretValueCommand).resolves({});
secretsMock.on(UpdateSecretVersionStageCommand).resolves({});

console.log("✅ AWS SDK mock configured.");

// --- Mock fetch (Instagram API) ------------------------------------------
global.fetch = async (url) => {
  if (url.toString().includes("refresh_access_token")) {
    return {
      ok: true,
      json: async () => ({
        access_token: "new_fake_token_123",
        expires_in: 5184000,
      }),
    };
  }
  if (url.toString().includes("graph.instagram.com/me")) {
    return {
      ok: true,
      json: async () => ({ id: "fake_user_123" }),
    };
  }
  return { ok: false, text: async () => "Unknown URL" };
};

// --- Load event and run handler ------------------------------------------
const events = JSON.parse(readFileSync("./stubs/refreshEvents.json", "utf-8"));
const arg = process.argv[2];

// Determine which events to run
const steps = arg
  ? [arg]
  : ["createSecret", "setSecret", "testSecret", "finishSecret"];

(async () => {
  for (const step of steps) {
    console.log(`\n🚀 Running mocked step: ${step}`);
    try {
      await handler(events[step]);
      console.log(`✅ Step ${step} completed successfully`);
    } catch (err) {
      console.error(`❌ Step ${step} failed:`, err);
      break;
    }
  }
})();
