import { describe, expect, it, vi } from 'vitest';
import { streamErrorHandler } from '../lambda/middleware/stream-error-handler';

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe('streamErrorHandler', () => {
  it('logs AbortError at warn level', () => {
    const logger = createMockLogger();
    const handler = streamErrorHandler(logger);

    const error = new Error('The operation was aborted');
    error.name = 'AbortError';

    handler({ error });

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs ERR_INVALID_STATE as abort at warn level', () => {
    const logger = createMockLogger();
    const handler = streamErrorHandler(logger);

    const error = new TypeError('Invalid state: Reader released');
    (error as unknown as { code: string }).code = 'ERR_INVALID_STATE';

    handler({ error });

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('detects nested AbortError in cause chain', () => {
    const logger = createMockLogger();
    const handler = streamErrorHandler(logger);

    const cause = new Error('aborted');
    cause.name = 'AbortError';
    const error = new Error('AI SDK error', { cause });

    handler({ error });

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs non-abort errors at error level', () => {
    const logger = createMockLogger();
    const handler = streamErrorHandler(logger);

    handler({ error: new Error('connection timeout') });

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('handles non-Error values', () => {
    const logger = createMockLogger();
    const handler = streamErrorHandler(logger);

    handler({ error: 'string error' });

    expect(logger.error).toHaveBeenCalledWith('Unknown streaming error', {
      error: 'string error',
    });
  });
});
