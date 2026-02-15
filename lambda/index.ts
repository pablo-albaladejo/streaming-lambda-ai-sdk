import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { streamErrorHandler } from './middleware/stream-error-handler';
import { streamingService } from './streaming-service';

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

const streamHandler = async (
  event: APIGatewayProxyEvent,
): Promise<HttpStreamResponse> => {
  const body = JSON.parse(event.body ?? '{}');
  const prompt: string = body.prompt ?? 'Summarize the benefits of serverless architecture';

  const result = streamingService({ prompt }, onError);
  const response = result.toTextStreamResponse();

  return {
    body: response.body ?? '',
    headers: Object.fromEntries(response.headers.entries()),
    statusCode: response.status,
  };
};

// ---------------------------------------------------------------
// THE BROKEN AFTER HOOK
// ---------------------------------------------------------------
// This middleware demonstrates the core problem: Middy's `after`
// hook runs AFTER the handler returns but BEFORE the stream body
// is consumed by the Lambda runtime. At T1, the response object
// exists but the ReadableStream has not been read yet.
//
// Timeline:
//   T0: Handler returns { body: ReadableStream, statusCode: 200 }
//   T1: Middy `after` hook fires  <-- HERE (stream is unread)
//   T2: Middy pipes response.body to Lambda's responseStream
//   T3: Client receives streamed chunks
//   T4: Stream ends
//
// Any work that depends on stream completion (logging the full
// response, publishing metrics, recording token counts) will see
// EMPTY data at T1. The stream has not been consumed yet.
//
// Uncomment the middleware below to see this in action:
//
// const brokenAfterHook: middy.MiddlewareObj = {
//   after: async (request) => {
//     // This runs at T1 — the stream body has NOT been read yet.
//     // Any attempt to log or publish "completed" data here will
//     // find nothing, because the data flows through the stream
//     // only at T2-T4.
//     logger.info('after hook fired', {
//       bodyType: typeof request.response?.body,
//       isReadableStream: request.response?.body instanceof ReadableStream,
//       // This will always be true — the stream exists but is unread
//     });
//   },
// };
// ---------------------------------------------------------------

export const handler = middy<APIGatewayProxyEvent, HttpStreamResponse>({
  streamifyResponse: true,
})
  .use(httpCors({ origins: ['*'] }))
  // .use(brokenAfterHook) // Uncomment to demonstrate the problem
  .handler(streamHandler);
