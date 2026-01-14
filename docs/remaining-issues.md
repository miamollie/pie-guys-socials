# Remaining Code Quality Issues

Created from code review on 2026-01-13

## 1. Improve Type Safety (Priority: High)

**Labels:** enhancement, technical-debt

**Description:**
Multiple functions and methods use `any` type which reduces type safety and IDE support.

**Affected Areas:**
- `handler` functions return `Promise<any>` (handler.ts, refresh.ts)
- `getInsights()` returns `Promise<any>` (lambda/clients/insta/index.ts)
- `request()` returns `Promise<any>` (lambda/clients/insta/index.ts)
- `getRecommendation()` accepts `igInsights: any` (lambda/clients/recommendation/index.ts)
- `putSecretValue()` accepts `value: any` (lambda/clients/secrets/index.ts)

**Proposed Solution:**
Create proper TypeScript interfaces for:
- Instagram API responses (media objects, insights)
- LLM responses (recommendation output)
- Handler return types (success/error responses)
- Secrets Manager values (token structure)

**Benefits:**
- Better IDE autocomplete
- Compile-time error checking
- Improved code documentation
- Easier refactoring

---

## 2. Scope Down IAM Policy Resources (Priority: High - Security)

**Labels:** security, enhancement

**Description:**
Three IAM policies use `resources: ["*"]` which grants overly broad permissions. This violates the principle of least privilege.

**Affected Locations:**
1. WeeklyInsightWorker Secrets Manager permissions (lib/pie-guys-socials-stack.ts:53)
2. WeeklyInsightWorker SES permissions (lib/pie-guys-socials-stack.ts:61)
3. RefreshIgTokenLambda Secrets Manager permissions (lib/pie-guys-socials-stack.ts:93)

**Proposed Solution:**
Replace wildcard resources with specific ARNs:
```typescript
// For Secrets Manager
resources: [igSecret.secretArn, openAiSecret.secretArn]

// For SES
resources: [
  `arn:aws:ses:${this.region}:${this.account}:identity/${process.env.FROM_EMAIL}`
]
```

**Security Impact:**
Following principle of least privilege reduces potential blast radius if Lambda is compromised.

---

## 3. Implement Secret Rotation Validation (Priority: Medium)

**Labels:** enhancement, security

**Description:**
The refresh Lambda has commented-out validation logic for secret rotation steps (lambda/refresh.ts:18).

**Current State:**
```typescript
// todo figure out validation
// const metadata = await client.send(...)
// const versions = metadata.VersionIdsToStages || {};
// ...validation logic...
```

**Proposed Solution:**
Uncomment and implement the validation logic to:
1. Verify the secret version exists
2. Check if version is already current (skip rotation)
3. Ensure version is marked as AWSPENDING before proceeding

**Benefits:**
- Prevents duplicate rotations
- Catches invalid rotation requests early
- Better error handling and logging

---

## 4. Add Environment Variable Validation (Priority: Medium)

**Labels:** enhancement, reliability

**Description:**
Multiple places use `process.env.X!` assertions without validation, which can lead to runtime errors if environment variables are missing.

**Affected Areas:**
- CDK Stack construction (process.env.IG_SECRET_NAME, etc.)
- Lambda handlers at runtime
- Client initialization

**Proposed Solution:**
1. Create a validation function at Lambda startup:
```typescript
function validateEnvVars() {
  const required = ['IG_SECRET_NAME', 'OPEN_AI_SECRET_NAME', 'IG_BUSINESS_ID', 'FROM_EMAIL', 'TO_EMAIL', 'AWS_REGION'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

2. Call at the top of handler functions
3. Add similar validation in CDK stack

**Benefits:**
- Fail fast with clear error messages
- Easier debugging of deployment issues
- Better production reliability

---

## 5. Add Feature Flag for Stub vs Real Instagram Client (Priority: Low)

**Labels:** enhancement, testing

**Status:** ✅ IMPLEMENTED - See PR #3

**Description:**
This feature has been completed. The application now supports stub mode via environment variables:
- `USE_STUB_IG=true` - Use stubbed Instagram client
- `USE_STUB_EMAIL=true` - Use stubbed email client
- `USE_STUB_LLM=true` - Use stubbed LLM client

See README.md for usage instructions.

---

## How to Create Issues

For each issue above:
1. Go to https://github.com/miamollie/pie-guys-socials/issues/new
2. Copy the title and description
3. Add the suggested labels
4. Submit

Or create them all at once via the GitHub CLI:
```bash
# Install gh CLI if needed: brew install gh

gh issue create -t "Improve type safety by replacing any types with proper interfaces" \
  -b "<paste description>" \
  -l "enhancement,technical-debt"

# Repeat for each issue...
```
