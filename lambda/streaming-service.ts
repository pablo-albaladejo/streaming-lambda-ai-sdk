import { bedrock } from '@ai-sdk/amazon-bedrock';
import { Output, streamText, wrapLanguageModel } from 'ai';
import type { LanguageModelMiddleware } from 'ai';
import { z } from 'zod';

const responseSchema = z.object({
  summary: z.string().describe('A concise summary of the topic'),
  keywords: z.array(z.string()).describe('Relevant keywords'),
});

const TIMEOUT_MS = 30_000;

type StreamParams = {
  prompt: string;
};

type OnError = (event: { error: unknown }) => void;

export const streamingService = (
  params: StreamParams,
  onError: OnError,
  middlewares: Array<LanguageModelMiddleware>,
) => {
  const baseModel = bedrock('anthropic.claude-3-5-sonnet-20241022-v2:0');

  const model = wrapLanguageModel({
    model: baseModel,
    middleware: middlewares,
  });

  return streamText({
    model,
    prompt: params.prompt,
    output: Output.object({ schema: responseSchema }),
    system:
      'You are a helpful assistant. Respond with a structured JSON object containing a summary and keywords about the topic the user asks about.',
    maxOutputTokens: 2000,
    temperature: 0.7,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    onError,
  });
};
