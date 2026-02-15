type StreamErrorCause = {
  message: string;
  name: string;
  stack: string | undefined;
  text?: string;
  usage?: unknown;
};

const isAbortError = (error: Error): boolean => {
  if (error.name === 'AbortError') return true;

  if (
    error.name === 'TypeError' &&
    'code' in error &&
    error.code === 'ERR_INVALID_STATE'
  )
    return true;

  if (error.cause instanceof Error) {
    return isAbortError(error.cause);
  }

  return false;
};

const extractCause = (error: unknown): StreamErrorCause | undefined => {
  if (!(error instanceof Error)) return undefined;

  const cause = error.cause;
  if (!(cause instanceof Error)) return undefined;

  return {
    message: cause.message,
    name: cause.name,
    stack: cause.stack,
    ...('text' in cause ? { text: String(cause.text) } : {}),
    ...('usage' in cause ? { usage: cause.usage } : {}),
  };
};

export const streamErrorHandler = (
  logger: { warn: (...args: Array<unknown>) => void; error: (...args: Array<unknown>) => void },
) => {
  return ({ error }: { error: unknown }): void => {
    if (!(error instanceof Error)) {
      logger.error('Unknown streaming error', { error });
      return;
    }

    const cause = extractCause(error);

    if (isAbortError(error)) {
      logger.warn('Stream aborted (client disconnect or timeout)', {
        cause,
        errorType: 'AbortError',
        message: error.message,
      });
      return;
    }

    logger.error('Streaming error', {
      cause,
      errorType: 'StreamError',
      message: error.message,
      stack: error.stack,
    });
  };
};
