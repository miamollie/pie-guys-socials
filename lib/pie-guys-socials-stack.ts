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

    // Get secret names from CDK context (build-time config)
    const igSecretName = this.node.tryGetContext('igSecretName') || 'INSTAGRAM_SECRET_KEY';
    const openAiSecretName = this.node.tryGetContext('openAiSecretName') || 'OPEN_AI_SECRET_KEY';

    const igSecret = secrets.Secret.fromSecretNameV2(
      this,
      "IgTokenSecret",
      igSecretName
    );
    const openAiSecret = secrets.Secret.fromSecretNameV2(
      this,
      "OpenAIKeySecret",
      openAiSecretName
    );

    // Runtime configuration from environment (passed to Lambda)
    const runtimeConfig = {
      IG_BUSINESS_ID: process.env.IG_BUSINESS_ID || '',
      FROM_EMAIL: process.env.FROM_EMAIL || '',
      TO_EMAIL: process.env.TO_EMAIL || '',
      USE_STUB_IG: process.env.USE_STUB_IG || 'false',
      USE_STUB_EMAIL: process.env.USE_STUB_EMAIL || 'false',
      USE_STUB_LLM: process.env.USE_STUB_LLM || 'false',
      USE_STUB_SECRETS: process.env.USE_STUB_SECRETS || 'false',
    };

    // Lambda
    const worker = new lambdaNode.NodejsFunction(this, "WeeklyInsightWorker", {
      entry: `${__dirname}/../lambda/handler.ts`,
      handler: "handler",
      memorySize: 1024,
      timeout: cdk.Duration.minutes(2),
      environment: {
        IG_SECRET_NAME: igSecret.secretName,
        OPEN_AI_SECRET_NAME: openAiSecret.secretName,
        IG_BUSINESS_ID: runtimeConfig.IG_BUSINESS_ID,
        FROM_EMAIL: runtimeConfig.FROM_EMAIL,
        TO_EMAIL: runtimeConfig.TO_EMAIL,
        REGION: this.region,
        // Stub mode flags - set to "true" to use stubbed clients
        USE_STUB_IG: runtimeConfig.USE_STUB_IG,
        USE_STUB_EMAIL: runtimeConfig.USE_STUB_EMAIL,
        USE_STUB_LLM: runtimeConfig.USE_STUB_LLM,
        USE_STUB_SECRETS: runtimeConfig.USE_STUB_SECRETS,
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
        environment: {
          USE_STUB_IG: runtimeConfig.USE_STUB_IG,
          USE_STUB_SECRETS: runtimeConfig.USE_STUB_SECRETS,
        },
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
