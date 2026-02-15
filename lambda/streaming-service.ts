import { bedrock } from '@ai-sdk/amazon-bedrock';
import { Output, streamText } from 'ai';
import { z } from 'zod';

const responseSchema = z.object({
  summary: z.string().describe('A concise summary of the topic'),
  keywords: z.array(z.string()).describe('Relevant keywords'),
});

type StreamParams = {
  prompt: string;
};

export const streamingService = (params: StreamParams) => {
  const model = bedrock('anthropic.claude-3-5-sonnet-20241022-v2:0');

  return streamText({
    model,
    prompt: params.prompt,
    output: Output.object({ schema: responseSchema }),
    system:
      'You are a helpful assistant. Respond with a structured JSON object containing a summary and keywords about the topic the user asks about.',
    maxOutputTokens: 2000,
    temperature: 0.7,
  });
};
