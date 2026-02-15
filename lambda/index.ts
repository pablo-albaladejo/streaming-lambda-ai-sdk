import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { DataStoreMiddleware } from './ai-middleware/data-store-middleware';
import { LoggingMiddleware } from './ai-middleware/logging-middleware';
import { publishLog } from './middleware/publish-log';
import { streamErrorHandler } from './middleware/stream-error-handler';
import { streamingService } from './streaming-service';
import { llmLogDataStore } from './utils/log-data-store';

type HttpStreamResponse = {
  body: ReadableStream<Uint8Array> | string;
  headers: Record<string, string>;
  statusCode: number;
};

const logger = {
  info: (...args: Array<unknown>) => console.log('[INFO]', ...args),
  warn: (...args: Array<unknown>) => console.warn('[WARN]', ...args),
  error: (...args: Array<unknown>) => console.error('[ERROR]', ...args),
};

const onError = streamErrorHandler(logger);

// AI SDK middlewares — operate on the LanguageModel stream (LanguageModelV3StreamPart)
const aiMiddlewares = [
  LoggingMiddleware(logger),
  DataStoreMiddleware(llmLogDataStore.set),
];

const streamHandler = async (
  event: APIGatewayProxyEvent,
): Promise<HttpStreamResponse> => {
  const body = JSON.parse(event.body ?? '{}');
  const prompt: string = body.prompt ?? 'Summarize the benefits of serverless architecture';

  const result = streamingService({ prompt }, onError, aiMiddlewares);
  const response = result.toTextStreamResponse();

  return {
    body: response.body ?? '',
    headers: Object.fromEntries(response.headers.entries()),
    statusCode: response.status,
  };
};

// Middy middleware chain:
//   1. httpCors         — adds CORS headers
//   2. publishLog       — before: clears store
//                         after (streaming): wraps body with TransformStream
//                         after (non-streaming): publishes immediately
//
// Data flow for a streaming response:
//
//   streamText()
//     → AI SDK stream (LanguageModelV3StreamPart)
//       → LoggingMiddleware.wrapStream    (flush: logs completion)
//       → DataStoreMiddleware.wrapStream  (flush: stores data)
//     → toTextStreamResponse()
//       → ReadableStream<Uint8Array>
//         → publishLog TransformStream    (flush: publishes stored data)
//           → Middy pipes to Lambda responseStream
//             → API Gateway streams to client

export const handler = middy<APIGatewayProxyEvent, HttpStreamResponse>({
  streamifyResponse: true,
})
  .use(httpCors({ origins: ['*'] }))
  .use(publishLog(llmLogDataStore, logger))
  .handler(streamHandler);
