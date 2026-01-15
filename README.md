# Pie Guys Social Media AI Pipeline

This project sets up a lightweight automated pipeline to track Instagram performance for **The Pie Guys** and generate insights via LLM.  
The pipeline is built using **AWS CDK (TypeScript)**, **Lambda**, and **EventBridge**, with secrets managed manually in **AWS Secrets Manager**.

---

## 🎯 Intent

- Fetch recent Instagram posts, likes, and comments from the **Instagram Graph API**.
- Summarize performance using an **LLM**.
- Email a weekly summary (suggesting next posts).
- Keep Instagram API tokens refreshed automatically.

This replaces the need for a third-party social media agency with a lean, low-maintenance AI-driven workflow.

---

## 🏗️ Architecture

EventBridge (cron schedule)
│
▼
+------------------+
| Refresh Lambda | → refreshes IG token every ~50 days
+------------------+
│
▼
AWS Secrets Manager
│
▼
+------------------+
| Summary Lambda | → fetches IG data, sends to LLM, emails results
+------------------+

### Components

- **AWS Lambda**

  - `refreshLambda`: refreshes IG long-lived access token.
  - `summaryLambda`: pulls IG data, processes with LLM, emails summary.

- **EventBridge**

  - Runs `refreshLambda` monthly.
  - Runs `summaryLambda` weekly.

- **AWS Secrets Manager**  
  Stores app secrets entered manually via AWS console.

---

## ⚡ Useful Commands


```bash
npm install
```

### Configuration

This project follows **12-factor app** principles with clear separation between:
- **Build-time config**: Infrastructure settings in `cdk.json` (secret names, etc.)
- **Deploy-time config**: AWS account/region from AWS CLI credentials
- **Runtime config**: Business values via environment variables (emails, IDs, stub flags)

#### Build-Time Configuration (cdk.json)

Secret names and other infrastructure config are stored in `cdk.json` context:
- `igSecretName`: Name of Instagram secret in Secrets Manager (default: `INSTAGRAM_SECRET_KEY`)
- `openAiSecretName`: Name of OpenAI secret in Secrets Manager (default: `OPEN_AI_SECRET_KEY`)

Override via command line:
```bash
cdk deploy --context igSecretName=MY_IG_SECRET
```

#### Deploy-Time Configuration

AWS account and region are automatically detected from your AWS CLI configuration:
```bash
# Uses default AWS profile
cdk deploy

# Use specific profile
cdk deploy --profile production

# Explicit account/region
cdk deploy --context account=123456789 --context region=us-east-1
```

#### Runtime Configuration (.env)

Business configuration and feature flags go in `.env` file:
```bash
cp .env.example .env
# Edit .env with your values
```

Required runtime environment variables:
- `TO_EMAIL`: Recipient email address
- `FROM_EMAIL`: SES verified sender email
- `IG_BUSINESS_ID`: Instagram Business Account ID
- `USE_STUB_*`: Feature flags for testing mode

### Deploy CDK Stack

```bash
npm run cdk:deploy # deploy
npm run cdk:synth   # synthesize CloudFormation template
npm run cdk:diff    # compare with deployed stack
```

## Testing

### Stub Mode for End-to-End Testing

The application supports **stub mode** to test the entire infrastructure and code flow without hitting external APIs. This is perfect for:
- Testing deployments without using API quotas/tokens
- Development and debugging
- Cost-effective integration testing

Set these environment variables to enable stub mode:
```bash
USE_STUB_IG=true      # Use stubbed Instagram client (no API calls)
USE_STUB_EMAIL=true   # Log emails instead of sending via SES
USE_STUB_LLM=true     # Use pre-generated LLM response (no OpenAI tokens)
```

**Deploy in stub mode:**
```bash
# Copy example env file and set stub flags to true
cp .env.example .env
# Edit .env and set USE_STUB_* to true

# Deploy with stubbed clients
npm run cdk:deploy
```

**Production deployment:**
Set all `USE_STUB_*` variables to `false` in your `.env` file before deploying.

### Unit Tests
e2e tests using SAM CLI
Unit tests using Jest

## 📝 Decisions & Tradeoffs

Secrets handled manually → simpler for MVP, avoids mistakes.

No AgentDB for now → we pull live IG data each run instead of persisting.

No third-party integrations (Buffer/Phyllo) → costs and complexity not justified.

Iterative approach:

Iteration 1: Email-only summaries, manual posting.

Later: Draft post suggestions, possible auto-scheduling.

### Notes on access tokens

GET https://graph.instagram.com/access_token
?grant_type=ig_exchange_token
&client_secret=<INSTAGRAM_APP_SECRET>
&access_token=<VALID_SHORT_LIVED_ACCESS_TOKEN>

App access tokens are used to make requests to Facebook APIs on behalf of an app rather than a user. This can be used to modify the parameters of your app, create and manage test users, or read your app's insights.

Your App ID
Your App Secret

```
  curl -X GET "https://graph.facebook.com/oauth/access_token
  ?client_id={your-app-id}
  &client_secret={your-app-secret}
  &grant_type=client_credentials"
```

There is another method to make calls to the Graph API that doesn't require using a generated app access token. You can just pass your app ID and app secret as the access_token parameter when you make a call:
what?!

app id: 1352039616503788
app secrect:

https://developers.facebook.com/docs/instagram-platform/insights

if you use instagram with FB login, then use the fb graph base

insights endpoint requires user access token:

A User access token is used if your app takes actions in real time, based on input from the user. This kind of access token is needed any time the app calls an API to read, modify or write a specific person's Facebook data on their behalf. A User access tokens is generally obtained via a login dialog and requires a person to permit your app to obtain one.

Exchange access token requires ???

App IDs: Apps that use Facebook Login for Business will use the Meta app ID displayed at the top of the Meta App Dashboard for your app

https://developers.facebook.com/tools/accesstoken
https://developers.facebook.com/tools/debug/accesstoken

Insighyd API can get for a userID or for a media

So lambda can call first for the user in the past week, then for each media posted that week

Instagram media ID? How to get..
Instagram account ID? 2178730279

business id? || "1104480968021448"

## OpenAI example Curl

```
 curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are an assistant that summarizes social media performance from tabular data and suggests 3 post drafts with captions and hashtags. Provide your response in Markdown.",},
      {"role": "user", "content": "Here is the last weeks posts: Please summarize top performing themes, 3 suggested posts (caption + hashtags), and include evidence lines pointing to the original post IDs."}
    ],
    "max_tokens": 150,
    "temperature": 0.7
  }'



  curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
  "prompt": {
    "id": "pmpt_6913c0cd3200819692ce2481074d33f90e6f57cf8aa60c6e",
    "version": "1"
  }
}'
```
