import type middy from '@middy/core';
import type { LlmLogDataStore } from '../utils/log-data-store';

type StreamResponse = {
  body: ReadableStream<Uint8Array>;
  headers: Record<string, string>;
  statusCode: number;
};

type Logger = {
  info: (...args: Array<unknown>) => void;
  error: (...args: Array<unknown>) => void;
};

const isStreamResponse = (response: unknown): response is StreamResponse =>
  typeof response === 'object' &&
  response !== null &&
  'body' in response &&
  (response as StreamResponse).body instanceof ReadableStream;

export const publishLog = (
  llmLogDataStore: LlmLogDataStore,
  logger: Logger,
): middy.MiddlewareObj => {
  const publishImmediately = async (): Promise<void> => {
    const data = llmLogDataStore.get();
    if (!data) return;

    try {
      // In production, publish to SNS, Kinesis, etc.
      // Here we log to CloudWatch as the observability target.
      logger.info('LLM log data (non-streaming)', { data });
    } catch (error) {
      logger.error('Failed to publish LLM log data', { error });
    } finally {
      llmLogDataStore.clear();
    }
  };

  const publishAfterStreamConsumption = (request: middy.Request): void => {
    const response = request.response as StreamResponse;

    // Wrap the response body with a TransformStream whose flush()
    // callback fires AFTER the entire stream has been consumed.
    // This is the solution to the after hook timing problem.
    const publishTransform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk: Uint8Array, controller): void {
        controller.enqueue(chunk);
      },

      async flush(): Promise<void> {
        try {
          const data = llmLogDataStore.get();
          if (!data) return;

          // In production, publish to SNS, Kinesis, etc.
          logger.info('LLM log data (streaming)', { data });
        } catch (error) {
          logger.error('Failed to publish LLM log data', { error });
        } finally {
          llmLogDataStore.clear();
        }
      },
    });

    (request.response as StreamResponse).body =
      response.body.pipeThrough(publishTransform);
  };

  return {
    before: (): void => {
      llmLogDataStore.clear();
    },

    after: async (request: middy.Request): Promise<void> => {
      if (isStreamResponse(request.response)) {
        // Streaming: defer publication to flush() after stream ends
        publishAfterStreamConsumption(request);
        return;
      }

      // Non-streaming: publish immediately
      await publishImmediately();
    },

    onError: async (): Promise<void> => {
      await publishImmediately();
    },
  };
};
