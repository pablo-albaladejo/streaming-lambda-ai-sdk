import type { LanguageModelMiddleware } from 'ai';
import { createStreamTransform } from '../utils/create-stream-transform';

type Logger = {
  info: (...args: Array<unknown>) => void;
};

export const LoggingMiddleware = (logger: Logger): LanguageModelMiddleware => ({
  specificationVersion: 'v3',

  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();

    logger.info('LLM call completed', {
      usage: result.usage,
      modelId: result.response?.modelId,
    });

    return result;
  },

  wrapStream: async ({ doStream }) => {
    const result = await doStream();

    return {
      ...result,
      stream: createStreamTransform(result.stream, (streamParts) => {
        logger.info('LLM streaming call completed', {
          chunkCount: streamParts.length,
        });
      }),
    };
  },
});
