import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";

export class PieGuysSocialsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ********** Configuration (adjust as needed) **********
    const scheduleCron = events.Schedule.expression("cron(0 17 ? * FRI *)");
    // This triggers every Friday at 17:00 UTC (adjust if you want strict Europe/Dublin handling)
    // *******************************************************

    // Secrets (create in console or via CDK separately) - we reference existing secrets by name/ARN
    // Expect these secrets to exist:
    // - IG_TOKEN_SECRET_NAME (contains the Instagram Graph API token)
    // - OPENAI_API_KEY_SECRET_NAME (or LLM provider key)
    const igSecret = secrets.Secret.fromSecretNameV2(
      this,
      "IgTokenSecret",
      "IG_TOKEN_SECRET_NAME"
    );
    const openAiSecret = secrets.Secret.fromSecretNameV2(
      this,
      "OpenAIKeySecret",
      "OPENAI_API_KEY_SECRET_NAME"
    );

    // Lambda
    const worker = new lambdaNode.NodejsFunction(this, "WeeklyInsightWorker", {
      // runtime: lambdaNode.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambda/handler.ts`,
      handler: "handler",
      memorySize: 1024,
      timeout: cdk.Duration.minutes(2),
      environment: {
        IG_TOKEN_SECRET_NAME: igSecret.secretName,
        OPENAI_SECRET_NAME: openAiSecret.secretName,
        AGENTDB_URL: "https://api.agentdb.dev/your-db-endpoint", // replace with your AgentDB URL
        FROM_EMAIL: "no-reply@yourdomain.com",
        TO_EMAIL: "owner@pieguys.example",
        REGION: this.region,
        APPROVE_URL_BASE: "https://example.com/approve", // optional, for future
      },
    });

    // Allow Lambda to read those secrets
    igSecret.grantRead(worker.role!);
    openAiSecret.grantRead(worker.role!);

    // SES send email permissions
    worker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"], //TODO this is a bit generous?
      })
    );

    // EventBridge rule -> Lambda target
    const rule = new events.Rule(this, "WeeklyRule", {
      schedule: scheduleCron,
      ruleName: "PieWeeklyInsightRule",
      description: "Run weekly summary for social performance",
    });

    rule.addTarget(new targets.LambdaFunction(worker));

    const refreshLambda = new lambdaNode.NodejsFunction(
      this,
      "RefreshIgTokenLambda",
      {
        // runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambda/handler.ts`,
        handler: "refresh.handler",
        environment: {
          IG_SECRET_NAME: "IG_LONG_LIVED_TOKEN",
          FB_APP_ID: process.env.FB_APP_ID!,
          FB_APP_SECRET: process.env.FB_APP_SECRET!,
        },
      }
    );

    refreshLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
        ],
        resources: ["*"], // 🔒 tighten to specific secret ARN in prod
      })
    );

    // Run every 50 days (approx) → safer to do monthly
    new events.Rule(this, "RefreshSchedule", {
      schedule: events.Schedule.cron({ day: "1", hour: "0", minute: "0" }),
      targets: [new targets.LambdaFunction(refreshLambda)],
    });

    // Outputs
    new cdk.CfnOutput(this, "LambdaFunctionName", {
      value: worker.functionName,
    });
    new cdk.CfnOutput(this, "EventRuleName", { value: rule.ruleName });
  }
}
