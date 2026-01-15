# GitHub Actions AWS Setup Guide

This document walks through both authentication options for deploying to AWS from GitHub Actions.

---

## Option 1: IAM User with Access Keys (Simpler)

### Pros
- Quick setup (5 minutes)
- Easy to understand
- Works immediately

### Cons
- Long-lived credentials (security risk if leaked)
- Need manual rotation
- Against AWS security best practices

### Setup Steps

#### 1. Create IAM User in AWS Console

```bash
# Navigate to IAM → Users → Create user
User name: github-actions-deployer
```

#### 2. Create IAM Policy

Create a custom policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "events:*",
        "iam:*",
        "logs:*",
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "ses:*",
        "s3:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note:** This is broad. In production, scope down to specific resources.

#### 3. Attach Policy to User

```bash
# In AWS Console
IAM → Users → github-actions-deployer → Add permissions → Attach policies directly
```

#### 4. Generate Access Keys

```bash
# IAM → Users → github-actions-deployer → Security credentials
# Create access key → Select "Application running outside AWS"
# Download CSV with:
# - Access Key ID
# - Secret Access Key
```

#### 5. Add Secrets to GitHub

```bash
# In your repo: Settings → Secrets and variables → Actions → New repository secret
```

Add these secrets:
- `AWS_ACCESS_KEY_ID`: Your access key ID
- `AWS_SECRET_ACCESS_KEY`: Your secret access key
- `IG_SECRET_NAME`: Your Instagram secret name (e.g., `INSTAGRAM_SECRET_KEY`)
- `OPEN_AI_SECRET_NAME`: Your OpenAI secret name (e.g., `OPEN_AI_SECRET_KEY`)
- `IG_BUSINESS_ID`: Your Instagram business account ID
- `FROM_EMAIL`: Verified SES sender email
- `TO_EMAIL`: Recipient email

#### 6. Enable in Workflow

In `.github/workflows/deploy.yml`, uncomment this section:

```yaml
- name: Configure AWS credentials (IAM User)
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: eu-west-1
```

---

## Option 2: OIDC with IAM Role (Recommended)

### Pros
- No long-lived credentials
- More secure (no secrets stored in GitHub)
- AWS recommended approach
- Auto-rotating credentials
- Free

### Cons
- More complex initial setup
- Need to understand trust relationships

### How OIDC Works

```
┌──────────┐                        ┌──────────┐
│ GitHub   │  1. Request token      │   AWS    │
│ Actions  │ ──────────────────────>│   STS    │
│          │                        │          │
│          │  2. OIDC token         │          │
│          │ <──────────────────────│          │
│          │                        │          │
│          │  3. Assume role with   │          │
│          │     OIDC token         │          │
│          │ ──────────────────────>│          │
│          │                        │          │
│          │  4. Temporary creds    │          │
│          │ <──────────────────────│          │
└──────────┘                        └──────────┘
```

GitHub generates a signed JWT token that AWS verifies before issuing temporary credentials.

### Setup Steps

#### 1. Create OIDC Provider in AWS

```bash
# AWS Console: IAM → Identity providers → Add provider

Provider type: OpenID Connect
Provider URL: https://token.actions.githubusercontent.com
Audience: sts.amazonaws.com
```

**Or via AWS CLI:**

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

DONE: OpenIDConnectProviderArn": "arn:aws:iam::424795685451:oidc-provider/token.actions.githubusercontent.com

#### 2. Create IAM Role with Trust Policy

Create a new role: `GitHubActionsDeployRole`

**Trust Policy** (allows GitHub Actions to assume this role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/pie-guys-socials:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Replace:**
- `YOUR_ACCOUNT_ID`: Your AWS account ID (e.g., `424795685451`)
- `YOUR_GITHUB_USERNAME`: Your GitHub username (e.g., `miamollie`)



#### 3. Attach Permissions Policy to Role

Same policy as Option 1:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "events:*",
        "iam:*",
        "s3:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### 4. Add Secrets to GitHub

You still need these environment-specific secrets:

```bash
# Settings → Secrets and variables → Actions → New repository secret
```

- `IG_SECRET_NAME`: Instagram secret name
- `OPEN_AI_SECRET_NAME`: OpenAI secret name
- `IG_BUSINESS_ID`: Instagram business account ID
- `FROM_EMAIL`: Verified SES sender email
- `TO_EMAIL`: Recipient email

**Note:** You do NOT need `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` with OIDC!

#### 5. Enable in Workflow

In `.github/workflows/deploy.yml`:

**Uncomment the permissions block** at the top of the job:

```yaml
permissions:
  id-token: write  # Required for OIDC
  contents: read
```

**Uncomment the OIDC credentials step:**

```yaml
- name: Configure AWS credentials (OIDC)
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsDeployRole
    aws-region: eu-west-1
```

**Replace `YOUR_ACCOUNT_ID`** with your AWS account ID.

---

## Verification

### Test the Pipeline

1. **Push to a branch:**
   ```bash
   git checkout -b test-ci
   git push origin test-ci
   ```

2. **Create a PR to main**
   - Should trigger `.github/workflows/pr.yml`
   - Check: Tests pass, linting passes, Lambda bundles build

3. **Merge PR to main**
   - Should trigger `.github/workflows/deploy.yml`
   - Check: CDK deployment succeeds

### Troubleshooting

**OIDC: "Not authorized to perform sts:AssumeRoleWithWebIdentity"**
- Check trust policy `sub` condition matches your repo
- Verify OIDC provider exists in IAM
- Ensure permissions block has `id-token: write`

**IAM User: "Access Denied"**
- Check IAM policy is attached to user
- Verify secrets are correctly set in GitHub
- Check if MFA is required (shouldn't be for programmatic access)

**CDK Deploy fails: "Secret not found"**
- Ensure secrets exist in AWS Secrets Manager
- Check secret names match environment variables
- Verify IAM role/user has `secretsmanager:GetSecretValue` permission

---

## Security Best Practices

1. **Scope IAM permissions** - Replace `Resource: "*"` with specific ARNs
2. **Use branch protection** - Require PR reviews before merging to main
3. **Enable audit logging** - CloudTrail for all deployments
4. **Rotate credentials** - If using IAM user, rotate every 90 days
5. **Monitor deployments** - Set up SNS alerts for deployment failures

---

## Next Steps

1. Choose authentication method (OIDC recommended)
2. Follow setup steps above
3. Test with a branch push
4. Create a PR to verify PR checks work
5. Merge to main to trigger deployment
6. Monitor CloudWatch for Lambda execution

---

## Useful Commands

```bash
# View workflow runs
gh run list

# View logs for a specific run
gh run view <run-id> --log

# Manually trigger deployment
gh workflow run deploy.yml

# Check IAM role (AWS CLI)
aws iam get-role --role-name GitHubActionsDeployRole

# List OIDC providers
aws iam list-open-id-connect-providers
```
