import pino from "pino";
import { Context } from "aws-lambda";

/**
 * Structured logger for Lambda functions
 *
 * Features:
 * - JSON structured output for CloudWatch Logs Insights
 * - Automatic AWS Lambda context injection
 * - Request correlation IDs
 * - Performance timing helpers
 * - Pretty printing in local development
 */

const isDevelopment = process.env.NODE_ENV === "development";

// Configure pino with Lambda-optimized settings
const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  // Use pretty printing in development/stub mode, JSON in production
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Base fields for all logs
  base: {
    service: "pie-guys-socials",
    environment: process.env.NODE_ENV || "production",
  },

  // Format timestamps as ISO 8601
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with Lambda context
 * Safely extracts context properties - will never throw
 */
export function createLogger(context?: Context) {
  if (!context) {
    return logger;
  }
  // Directly pass context fields to child logger
  return logger.child({
    requestId: context.awsRequestId,
    functionName: context.functionName,
    functionVersion: context.functionVersion,
    memoryLimit: context.memoryLimitInMB,
    logGroup: context.logGroupName,
    logStream: context.logStreamName,
    remainingTime: typeof context.getRemainingTimeInMillis === 'function' ? context.getRemainingTimeInMillis() : undefined,
  });
}



/**
 * Log metrics for CloudWatch Logs Insights
 * These can be extracted and graphed in CloudWatch
 */
export function logMetric(
  name: string,
  value: number,
  unit: string = "Count",
  dimensions?: Record<string, string>
) {
  logger.info(
    {
      metric: name,
      value,
      unit,
      dimensions,
      _type: "metric", // Special field for filtering in CloudWatch
    },
    `Metric: ${name}=${value}${unit}`
  );
}

export default logger;
