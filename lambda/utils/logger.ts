import pino from "pino";

/**
 * AWS Lambda Context type
 */
export interface LambdaContext {
  awsRequestId?: string;
  functionName?: string;
  functionVersion?: string;
  memoryLimitInMB?: string;
  getRemainingTimeInMillis?: () => number;
  logGroupName?: string;
  logStreamName?: string;
}

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
export function createLogger(context?: LambdaContext) {
  if (!context) {
    return logger;
  }

  try {
    const contextFields: Record<string, any> = {};
    
    if (context.awsRequestId) contextFields.requestId = context.awsRequestId;
    if (context.functionName) contextFields.functionName = context.functionName;
    if (context.functionVersion) contextFields.functionVersion = context.functionVersion;
    if (context.memoryLimitInMB) contextFields.memoryLimit = context.memoryLimitInMB;
    if (context.logGroupName) contextFields.logGroup = context.logGroupName;
    if (context.logStreamName) contextFields.logStream = context.logStreamName;
    
    // Safe call to getRemainingTimeInMillis
    if (typeof context.getRemainingTimeInMillis === 'function') {
      try {
        contextFields.remainingTime = context.getRemainingTimeInMillis();
      } catch {
        // Ignore if this fails
      }
    }
    
    return logger.child(contextFields);
  } catch (error) {
    // If anything goes wrong, return base logger - logging should never break the app
    logger.warn({ error }, "Failed to create logger with context, using base logger");
    return logger;
  }
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
