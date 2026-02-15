import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { streamingService } from './streaming-service';

type HttpStreamResponse = {
  body: ReadableStream<Uint8Array> | string;
  headers: Record<string, string>;
  statusCode: number;
};

const streamHandler = async (
  event: APIGatewayProxyEvent,
): Promise<HttpStreamResponse> => {
  const body = JSON.parse(event.body ?? '{}');
  const prompt: string = body.prompt ?? 'Summarize the benefits of serverless architecture';

  const result = streamingService({ prompt });
  const response = result.toTextStreamResponse();

  return {
    body: response.body ?? '',
    headers: Object.fromEntries(response.headers.entries()),
    statusCode: response.status,
  };
};

export const handler = middy<APIGatewayProxyEvent, HttpStreamResponse>({
  streamifyResponse: true,
})
  .use(httpCors({ origins: ['*'] }))
  .handler(streamHandler);
