import { describe, expect, it, vi } from 'vitest';
import { publishLog } from '../lambda/middleware/publish-log';
import { createLlmLogDataStore } from '../lambda/utils/log-data-store';

const readStream = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value);
  }

  return result;
};

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('publishLog middleware', () => {
  it('clears the store on before hook', () => {
    const store = createLlmLogDataStore();
    const logger = createMockLogger();
    const middleware = publishLog(store, logger);

    store.set({ llmParam: { test: true }, llmResult: { ok: true } });
    expect(store.get()).toBeDefined();

    middleware.before!({} as never);

    expect(store.get()).toBeUndefined();
  });

  it('publishes immediately for non-streaming responses', async () => {
    const store = createLlmLogDataStore();
    const logger = createMockLogger();
    const middleware = publishLog(store, logger);

    store.set({ llmParam: { model: 'test' }, llmResult: { text: 'hello' } });

    const request = {
      response: {
        body: JSON.stringify({ result: 'ok' }),
        headers: {},
        statusCode: 200,
      },
    };

    await middleware.after!(request as never);

    expect(logger.info).toHaveBeenCalledWith(
      'LLM log data (non-streaming)',
      expect.objectContaining({ data: expect.any(Object) }),
    );
    expect(store.get()).toBeUndefined();
  });

  it('defers publication to flush() for streaming responses', async () => {
    const store = createLlmLogDataStore();
    const logger = createMockLogger();
    const middleware = publishLog(store, logger);

    const sourceStream = new ReadableStream<Uint8Array>({
      start(controller): void {
        controller.enqueue(new TextEncoder().encode('chunk1'));
        controller.enqueue(new TextEncoder().encode('chunk2'));
        controller.close();
      },
    });

    store.set({ llmParam: { model: 'test' }, llmResult: { tokens: 42 } });

    const request = {
      response: {
        body: sourceStream,
        headers: { 'content-type': 'text/plain' },
        statusCode: 200,
      },
    };

    // After hook wraps the stream — does NOT publish yet
    await middleware.after!(request as never);
    expect(logger.info).not.toHaveBeenCalled();

    // Consume the wrapped stream — flush() fires and publishes
    const body = await readStream(request.response.body as ReadableStream<Uint8Array>);

    expect(body).toBe('chunk1chunk2');
    expect(logger.info).toHaveBeenCalledWith(
      'LLM log data (streaming)',
      expect.objectContaining({ data: expect.any(Object) }),
    );
    expect(store.get()).toBeUndefined();
  });

  it('publishes on error hook', async () => {
    const store = createLlmLogDataStore();
    const logger = createMockLogger();
    const middleware = publishLog(store, logger);

    store.set({ llmParam: { model: 'test' }, llmResult: { error: true } });

    await middleware.onError!({} as never);

    expect(logger.info).toHaveBeenCalledWith(
      'LLM log data (non-streaming)',
      expect.any(Object),
    );
    expect(store.get()).toBeUndefined();
  });
});
