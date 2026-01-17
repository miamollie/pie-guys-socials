import { createLogger, logMetric, LambdaContext } from "./logger";
import logger from "./logger";

// Mock pino to capture log output
jest.mock("pino", () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };
  
  const pinoMock: any = jest.fn(() => mockLogger);
  pinoMock.stdTimeFunctions = {
    isoTime: () => new Date().toISOString(),
  };
  
  return pinoMock;
});

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLogger", () => {
    it("should return base logger when no context provided", () => {
      const result = createLogger();
      expect(result).toBe(logger);
    });

    it("should return base logger when context is undefined", () => {
      const result = createLogger(undefined);
      expect(result).toBe(logger);
    });

    it("should create child logger with Lambda context fields", () => {
      const context: LambdaContext = {
        awsRequestId: "test-request-123",
        functionName: "test-function",
        functionVersion: "$LATEST",
        memoryLimitInMB: "1024",
        logGroupName: "/aws/lambda/test",
        logStreamName: "2026/01/16/[$LATEST]abc123",
      };

      const result = createLogger(context);
      
      expect(logger.child).toHaveBeenCalledWith({
        requestId: "test-request-123",
        functionName: "test-function",
        functionVersion: "$LATEST",
        memoryLimit: "1024",
        logGroup: "/aws/lambda/test",
        logStream: "2026/01/16/[$LATEST]abc123",
      });
    });

    it("should handle partial context gracefully", () => {
      const context: LambdaContext = {
        awsRequestId: "test-request-123",
        // Missing other fields
      };

      const result = createLogger(context);
      
      expect(logger.child).toHaveBeenCalledWith({
        requestId: "test-request-123",
      });
    });

    it("should safely call getRemainingTimeInMillis", () => {
      const context: LambdaContext = {
        awsRequestId: "test-request-123",
        getRemainingTimeInMillis: jest.fn().mockReturnValue(5000),
      };

      createLogger(context);
      
      expect(context.getRemainingTimeInMillis).toHaveBeenCalled();
      expect(logger.child).toHaveBeenCalledWith({
        requestId: "test-request-123",
        remainingTime: 5000,
      });
    });

    it("should handle getRemainingTimeInMillis errors gracefully", () => {
      const context: LambdaContext = {
        awsRequestId: "test-request-123",
        getRemainingTimeInMillis: jest.fn().mockImplementation(() => {
          throw new Error("Function failed");
        }),
      };

      const result = createLogger(context);
      
      // Should not throw and should create child without remainingTime
      expect(logger.child).toHaveBeenCalledWith({
        requestId: "test-request-123",
      });
    });

    it("should return base logger if context parsing fails completely", () => {
      // Create a malicious context that throws on property access
      const context = new Proxy({}, {
        get() {
          throw new Error("Property access failed");
        }
      }) as LambdaContext;

      const result = createLogger(context);
      
      // Should fall back to base logger and log warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Error) }),
        "Failed to create logger with context, using base logger"
      );
    });
  });



  describe("logMetric", () => {
    it("should log metric with default unit", () => {
      logMetric("test-metric", 42);
      
      expect(logger.info).toHaveBeenCalledWith(
        {
          metric: "test-metric",
          value: 42,
          unit: "Count",
          dimensions: undefined,
          _type: "metric",
        },
        "Metric: test-metric=42Count"
      );
    });

    it("should log metric with custom unit", () => {
      logMetric("response-time", 150, "Milliseconds");
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: "response-time",
          value: 150,
          unit: "Milliseconds",
        }),
        "Metric: response-time=150Milliseconds"
      );
    });

    it("should log metric with dimensions", () => {
      const dimensions = { service: "api", environment: "prod" };
      logMetric("request-count", 1, "Count", dimensions);
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          metric: "request-count",
          value: 1,
          unit: "Count",
          dimensions,
          _type: "metric",
        }),
        "Metric: request-count=1Count"
      );
    });
  });

  describe("LambdaContext interface", () => {
    it("should accept all valid Lambda context properties", () => {
      const context: LambdaContext = {
        awsRequestId: "abc-123",
        functionName: "my-function",
        functionVersion: "1",
        memoryLimitInMB: "512",
        logGroupName: "/aws/lambda/my-function",
        logStreamName: "2026/01/16/stream",
        getRemainingTimeInMillis: () => 3000,
      };

      // Type check - if this compiles, the interface is correct
      expect(context).toBeDefined();
    });

    it("should accept partial context", () => {
      const context: LambdaContext = {
        awsRequestId: "abc-123",
      };

      expect(context).toBeDefined();
    });

    it("should accept empty context", () => {
      const context: LambdaContext = {};

      expect(context).toBeDefined();
    });
  });
});
