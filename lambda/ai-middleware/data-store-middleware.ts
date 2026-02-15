import type { LanguageModelMiddleware } from 'ai';
import { createStreamTransform } from '../utils/create-stream-transform';
import type { LlmLogData } from '../utils/log-data-store';

export const DataStoreMiddleware = (
  setData: (data: LlmLogData) => void,
): LanguageModelMiddleware => ({
  specificationVersion: 'v3',

  wrapGenerate: async ({ doGenerate, params }) => {
    const result = await doGenerate();

    setData({
      llmParam: params as Record<PropertyKey, unknown>,
      llmResult: result as Record<PropertyKey, unknown>,
    });

    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    const result = await doStream();

    return {
      ...result,
      stream: createStreamTransform(result.stream, (streamParts) => {
        setData({
          llmParam: params as Record<PropertyKey, unknown>,
          llmResult: {
            request: result.request,
            response: result.response,
            streamParts,
          },
        });
      }),
    };
  },
});
