import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";

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
        REGION: this.region,
        // Stub mode flags - set to "true" to use stubbed clients
        USE_STUB_IG: process.env.USE_STUB_IG || "false",
        USE_STUB_EMAIL: process.env.USE_STUB_EMAIL || "false",
        USE_STUB_LLM: process.env.USE_STUB_LLM || "false",
        USE_STUB_SECRETS: process.env.USE_STUB_SECRETS || "false",
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
          USE_STUB_IG: process.env.USE_STUB_IG || "false",
          USE_STUB_SECRETS: process.env.USE_STUB_SECRETS || "false",
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

    // =========================================================================
    // OBSERVABILITY: CloudWatch Alarms
    // =========================================================================

    // Alarm 1: Weekly insights handler errors
    const insightsErrorAlarm = new cloudwatch.Alarm(this, "InsightsErrorAlarm", {
      metric: worker.metricErrors({
        statistic: "Sum",
        period: cdk.Duration.hours(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Alert when weekly insights handler fails",
      alarmName: "pie-guys-insights-handler-errors",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm 2: Token refresh handler errors
    const refreshErrorAlarm = new cloudwatch.Alarm(this, "RefreshErrorAlarm", {
      metric: refreshLambda.metricErrors({
        statistic: "Sum",
        period: cdk.Duration.hours(1),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Alert when Instagram token refresh fails",
      alarmName: "pie-guys-refresh-handler-errors",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm 3: Weekly insights handler duration (slow operations)
    const insightsDurationAlarm = new cloudwatch.Alarm(
      this,
      "InsightsDurationAlarm",
      {
        metric: worker.metricDuration({
          statistic: "Average",
          period: cdk.Duration.hours(1),
        }),
        threshold: 30000, // 30 seconds in milliseconds
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: "Alert when weekly insights handler runs slow",
        alarmName: "pie-guys-insights-handler-slow",
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // =========================================================================
    // OBSERVABILITY: CloudWatch Dashboard
    // =========================================================================

    new cloudwatch.Dashboard(this, "PieGuysDashboard", {
      dashboardName: "PieGuys-Monitoring",
    }).addWidgets(
      // Row 1: Handler Status
      new cloudwatch.GraphWidget({
        title: "Insights Handler - Invocations & Errors",
        left: [
          worker.metricInvocations({
            label: "Invocations",
            statistic: "Sum",
            period: cdk.Duration.hours(6),
          }),
          worker.metricErrors({
            label: "Errors",
            statistic: "Sum",
            period: cdk.Duration.hours(6),
            color: cloudwatch.Color.RED,
          }),
        ],
        width: 12,
      }),

      new cloudwatch.GraphWidget({
        title: "Token Refresh - Invocations & Errors",
        left: [
          refreshLambda.metricInvocations({
            label: "Invocations",
            statistic: "Sum",
            period: cdk.Duration.hours(6),
          }),
          refreshLambda.metricErrors({
            label: "Errors",
            statistic: "Sum",
            period: cdk.Duration.hours(6),
            color: cloudwatch.Color.RED,
          }),
        ],
        width: 12,
      }),

      // Row 2: Latency
      new cloudwatch.GraphWidget({
        title: "Insights Handler - Duration (ms)",
        left: [
          worker.metricDuration({
            label: "Average",
            statistic: "Average",
            period: cdk.Duration.hours(6),
          }),
          worker.metricDuration({
            label: "Max",
            statistic: "Maximum",
            period: cdk.Duration.hours(6),
            color: cloudwatch.Color.ORANGE,
          }),
        ],
        width: 12,
      }),

      new cloudwatch.GraphWidget({
        title: "Token Refresh - Duration (ms)",
        left: [
          refreshLambda.metricDuration({
            label: "Average",
            statistic: "Average",
            period: cdk.Duration.hours(6),
          }),
          refreshLambda.metricDuration({
            label: "Max",
            statistic: "Maximum",
            period: cdk.Duration.hours(6),
            color: cloudwatch.Color.ORANGE,
          }),
        ],
        width: 12,
      }),

      // Row 3: Alarms Status
      new cloudwatch.SingleValueWidget({
        title: "Insights Handler - Error Status",
        metrics: [insightsErrorAlarm.metric],
        width: 6,
      }),

      new cloudwatch.SingleValueWidget({
        title: "Token Refresh - Error Status",
        metrics: [refreshErrorAlarm.metric],
        width: 6,
      }),

      new cloudwatch.SingleValueWidget({
        title: "Insights Duration - Slow Alert",
        metrics: [insightsDurationAlarm.metric],
        width: 6,
      }),

      // Row 4: Logs Insight
      new cloudwatch.LogQueryWidget({
        title: "Recent Errors (Last 24h)",
        logGroupNames: [
          worker.logGroup?.logGroupName || "",
          refreshLambda.logGroup?.logGroupName || "",
        ],
        queryString: `
          fields @timestamp, @message, functionName, operation, error
          | filter @message like /error|Error|ERROR|failed|Failed/
          | sort @timestamp desc
          | limit 20
        `,
        width: 24,
      })
    );
  }
}
