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

    const insightsCron = events.Schedule.expression("cron(0 17 ? * FRI *)");
    // This triggers every Friday at 17:00 UTC

    const igSecret = secrets.Secret.fromSecretNameV2(
      this,
      "IgTokenSecret",
      process.env.IG_SECRET_NAME!
    );
    const openAiSecret = secrets.Secret.fromSecretNameV2(
      this,
      "OpenAIKeySecret",
      process.env.OPEN_AI_SECRET_NAME!
    );

    // Lambda
    const worker = new lambdaNode.NodejsFunction(this, "WeeklyInsightWorker", {
      entry: `${__dirname}/../lambda/handler.ts`,
      handler: "handler",
      memorySize: 1024,
      timeout: cdk.Duration.minutes(2),
      environment: {
        IG_SECRET_NAME: igSecret.secretName,
        OPEN_AI_SECRET_NAME: openAiSecret.secretName,
        IG_BUSINESS_ID: process.env.IG_BUSINESS_ID!,
        FROM_EMAIL: process.env.FROM_EMAIL!,
        TO_EMAIL: process.env.TO_EMAIL!,
        AWS_REGION: this.region,
        REGION: this.region,
      },
    });

    worker.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:UpdateSecretVersionStage",
        ],
        resources: ["*"], //TODO this is too greedy
      })
    );

    // SES send email permissions
    worker.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"], //TODO this is a bit generous
      })
    );

    // EventBridge rule -> Lambda target
    const rule = new events.Rule(this, "WeeklyRule", {
      schedule: insightsCron,
      ruleName: "PieWeeklyInsightRule",
      description: "Run weekly summary for social performance",
    });

    rule.addTarget(new targets.LambdaFunction(worker));

    const refreshLambda = new lambdaNode.NodejsFunction(
      this,
      "RefreshIgTokenLambda",
      {
        entry: `${__dirname}/../lambda/refresh.ts`,
        handler: "handler",
      }
    );

    refreshLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:UpdateSecretVersionStage",
        ],
        resources: ["*"], //TODO this is a bit generous
      })
    );

    // Enable secrets manager to invoke lamba
    refreshLambda.addPermission("AllowSecretsManagerInvoke", {
      principal: new iam.ServicePrincipal("secretsmanager.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });
  }
}
