import { Writable } from 'node:stream';

type HttpResponseMetadata = {
  headers?: Record<string, string>;
  statusCode?: number;
};

type LambdaResponseStream = Writable & {
  __httpResponseMetadata?: HttpResponseMetadata;
  __chunks: Array<Buffer>;
};

export const setupAwsLambdaStreamingMock = (): void => {
  (globalThis as unknown as { awslambda: unknown }).awslambda = {
    HttpResponseStream: {
      from: (
        stream: LambdaResponseStream,
        metadata: HttpResponseMetadata,
      ): LambdaResponseStream => {
        stream.__httpResponseMetadata = metadata;
        return stream;
      },
    },
    streamifyResponse: <T>(handler: T): T => handler,
  };
};

const createLambdaResponseStream = (): LambdaResponseStream => {
  const chunks: Array<Buffer> = [];

  const stream = new Writable({
    write(chunk, _encoding, callback): void {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  }) as LambdaResponseStream;

  stream.__chunks = chunks;
  return stream;
};

type StreamifyHandler = (
  event: unknown,
  responseStream: Writable,
  context: unknown,
) => Promise<void>;

type StreamifyInvokeResult = {
  body: string;
  metadata: HttpResponseMetadata | undefined;
};

export const invokeStreamifyHandler = async (
  handler: StreamifyHandler,
  event: unknown,
  context: unknown = {},
): Promise<StreamifyInvokeResult> => {
  const responseStream = createLambdaResponseStream();
  await handler(event, responseStream, context);

  return {
    body: responseStream.__chunks.map((c) => c.toString()).join(''),
    metadata: responseStream.__httpResponseMetadata,
  };
};

export const createMockApiGatewayEvent = (body: Record<string, unknown>) => ({
  body: JSON.stringify(body),
  headers: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  path: '/v1/stream',
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    authorizer: {},
    httpMethod: 'POST',
    identity: {} as never,
    path: '/v1/stream',
    protocol: 'HTTP/1.1',
    requestId: 'test-request-id',
    requestTimeEpoch: Date.now(),
    resourceId: 'test',
    resourcePath: '/v1/stream',
    stage: 'v1',
  },
  resource: '/v1/stream',
  stageVariables: null,
});
