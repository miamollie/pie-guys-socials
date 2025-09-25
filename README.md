# Pie Guys Social Media AI Pipeline

This project sets up a lightweight automated pipeline to track Instagram performance for **The Pie Guys** and generate insights via LLM.  
The pipeline is built using **AWS CDK (TypeScript)**, **Lambda**, and **EventBridge**, with secrets managed manually in **AWS Secrets Manager**.

---

## 🎯 Intent

- Fetch recent Instagram posts, likes, and comments from the **Instagram Graph API**.
- Summarize performance using an **LLM**.
- Email a weekly summary (suggesting next posts).
- Keep Instagram API tokens refreshed automatically.

This replaces the need for a third-party social media agency (~€300/month) with a lean, low-maintenance AI-driven workflow.

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
  - `summaryLambda`: pulls IG data, processes with LLM, emails summary (future).

- **EventBridge**

  - Runs `refreshLambda` monthly.
  - Runs `summaryLambda` weekly.

- **AWS Secrets Manager**  
  Stores app secrets entered manually via AWS console.

---

## ⚡ Useful Commands

### Install Dependencies

```bash
npm install
Deploy CDK Stack
Using .env for local configuration:

bash
Copy code
npm run cdk:deploy
Other CDK Commands
bash
Copy code
npm run cdk:synth   # synthesize CloudFormation template
npm run cdk:diff    # compare with deployed stack
```

## 📝 Decisions & Tradeoffs

Secrets handled manually → simpler for MVP, avoids mistakes.

No AgentDB for now → we pull live IG data each run instead of persisting.

No third-party integrations (Buffer/Phyllo) → costs and complexity not justified.

Iterative approach:

Iteration 1: Email-only summaries, manual posting.

Later: Draft post suggestions, possible auto-scheduling.
