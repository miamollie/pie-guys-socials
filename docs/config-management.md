# Configuration Management

This document explains the configuration management strategy for the pie-guys-socials project, following **12-factor app** principles.

## Configuration Layers

### 1. Build-Time Configuration (cdk.json)

**Purpose**: Infrastructure settings that are baked into the CloudFormation template during `cdk synth`.

**Location**: `cdk.json` context section

**Values**:
- `igSecretName`: Name of the Instagram secret in AWS Secrets Manager (default: `INSTAGRAM_SECRET_KEY`)
- `openAiSecretName`: Name of the OpenAI secret in AWS Secrets Manager (default: `OPEN_AI_SECRET_KEY`)

**Usage**:
```bash
# Use defaults from cdk.json
cdk deploy

# Override specific values
cdk deploy --context igSecretName=MY_CUSTOM_IG_SECRET
cdk deploy --context openAiSecretName=MY_OPENAI_SECRET
```

**Why this approach?**
- Secret names are infrastructure decisions that rarely change
- They need to be known at synthesis time to create proper IAM permissions
- Storing in cdk.json makes them version-controlled and explicit
- No need for environment variables during CDK operations

### 2. Deploy-Time Configuration (AWS CLI)

**Purpose**: AWS account and region targeting for deployment.

**Location**: AWS CLI configuration (`~/.aws/config`, `~/.aws/credentials`)

**Values**:
- AWS Account ID
- AWS Region

**Usage**:
```bash
# Uses default AWS profile
cdk deploy

# Use specific profile
cdk deploy --profile production

# Or set explicitly
export AWS_PROFILE=production
cdk deploy
```

**Why this approach?**
- Follows standard AWS CLI/SDK conventions
- Uses `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` automatically set by CDK
- No need to duplicate AWS config in `.env` files
- Works seamlessly with IAM roles, AWS SSO, and credential helpers

### 3. Runtime Configuration (Environment Variables)

**Purpose**: Business logic configuration that varies between environments and is needed by Lambda at runtime.

**Location**: `.env` file (for local development) → passed to Lambda environment

**Values**:
- `TO_EMAIL`: Email recipient address
- `FROM_EMAIL`: SES verified sender address
- `IG_BUSINESS_ID`: Instagram Business Account ID
- `USE_STUB_IG`: Enable stubbed Instagram client (testing)
- `USE_STUB_EMAIL`: Enable stubbed email client (testing)
- `USE_STUB_LLM`: Enable stubbed LLM client (testing)
- `USE_STUB_SECRETS`: Enable stubbed secrets client (testing)

**Usage**:
```bash
# Copy example
cp .env.example .env

# Edit with your values
vim .env

# Deploy (runtime config is read during synthesis and passed to Lambda)
npm run cdk:deploy
```

**Why this approach?**
- These values change between dev/staging/production
- They are business logic, not infrastructure decisions
- Lambda needs them at runtime to function
- Easy to change without redeploying infrastructure

## Migration from Old Approach

### Before (Problematic)
```typescript
// bin/pie-guys-socials.ts
env: { account: process.env.AWS_ACCOUNT, region: process.env.AWS_REGION }

// lib/pie-guys-socials-stack.ts
secrets.Secret.fromSecretNameV2(this, "IgTokenSecret", process.env.IG_SECRET_NAME!)
```

**Problems**:
- Required setting `AWS_ACCOUNT` and `AWS_REGION` in `.env` (duplicating AWS CLI config)
- Mixed build-time and runtime concerns
- Secret names hardcoded via environment variables
- Violated 12-factor separation of config layers

### After (Clean)
```typescript
// bin/pie-guys-socials.ts
env: {
  account: process.env.CDK_DEFAULT_ACCOUNT,  // Auto-set by CDK from AWS CLI
  region: process.env.CDK_DEFAULT_REGION,    // Auto-set by CDK from AWS CLI
}

// lib/pie-guys-socials-stack.ts
const igSecretName = this.node.tryGetContext('igSecretName') || 'INSTAGRAM_SECRET_KEY';
const igSecret = secrets.Secret.fromSecretNameV2(this, "IgTokenSecret", igSecretName);

// Runtime config explicitly separated
const runtimeConfig = {
  IG_BUSINESS_ID: process.env.IG_BUSINESS_ID || '',
  FROM_EMAIL: process.env.FROM_EMAIL || '',
  // ... etc
};
```

**Benefits**:
- Clear separation: build-time (context) vs deploy-time (AWS CLI) vs runtime (Lambda env)
- No duplicate AWS configuration
- Infrastructure config is version-controlled in cdk.json
- Runtime config easily overridden per environment
- Follows standard CDK and AWS best practices

## Best Practices

1. **Never read process.env during CDK synthesis for infrastructure decisions**
   - Use CDK context instead
   - Pass stack props from app

2. **Use CDK_DEFAULT_* for AWS account/region**
   - Automatically set by CDK from AWS CLI
   - No need for custom env vars

3. **Keep runtime config minimal**
   - Only values Lambda actually needs at runtime
   - Document clearly in .env.example

4. **Version control build-time config**
   - cdk.json is committed
   - Makes infrastructure config explicit and reviewable

5. **Use sensible defaults**
   - `tryGetContext()` with fallback values
   - Makes the stack more portable

## Troubleshooting

### "Cannot find context value"
Add the value to cdk.json or pass via `--context` flag.

### "Invalid AWS credentials"
Check your AWS CLI configuration:
```bash
aws configure list
aws sts get-caller-identity
```

### "Lambda missing environment variable"
Ensure the variable is in your `.env` file and you've redeployed.

### "Secret not found"
Ensure the secret names in cdk.json match your AWS Secrets Manager secret names.
