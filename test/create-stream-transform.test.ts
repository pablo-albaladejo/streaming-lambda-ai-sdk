import { describe, expect, it, vi } from 'vitest';
import { createStreamTransform } from '../lambda/utils/create-stream-transform';

const readStream = async <T>(stream: ReadableStream<T>): Promise<Array<T>> => {
  const reader = stream.getReader();
  const chunks: Array<T> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return chunks;
};

describe('createStreamTransform', () => {
  it('passes all chunks through unchanged', async () => {
    const source = new ReadableStream<string>({
      start(controller): void {
        controller.enqueue('hello');
        controller.enqueue(' ');
        controller.enqueue('world');
        controller.close();
      },
    });

    const onFlush = vi.fn();
    const transformed = createStreamTransform(source, onFlush);
    const result = await readStream(transformed);

    expect(result).toEqual(['hello', ' ', 'world']);
  });

  it('calls onFlush with all accumulated chunks after stream ends', async () => {
    const source = new ReadableStream<string>({
      start(controller): void {
        controller.enqueue('a');
        controller.enqueue('b');
        controller.enqueue('c');
        controller.close();
      },
    });

    const onFlush = vi.fn();
    const transformed = createStreamTransform(source, onFlush);
    await readStream(transformed);

    expect(onFlush).toHaveBeenCalledOnce();
    expect(onFlush).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('swallows errors thrown in onFlush', async () => {
    const source = new ReadableStream<string>({
      start(controller): void {
        controller.enqueue('data');
        controller.close();
      },
    });

    const onFlush = vi.fn().mockRejectedValue(new Error('publish failed'));
    const transformed = createStreamTransform(source, onFlush);

    // Should not throw even though onFlush rejects
    const result = await readStream(transformed);
    expect(result).toEqual(['data']);
    expect(onFlush).toHaveBeenCalledOnce();
  });

  it('does not call onFlush when stream is cancelled', async () => {
    const source = new ReadableStream<string>({
      start(controller): void {
        controller.enqueue('first');
        // Stream stays open — simulates an ongoing LLM stream
      },
    });

    const onFlush = vi.fn();
    const transformed = createStreamTransform(source, onFlush);
    const reader = transformed.getReader();

    await reader.read(); // Read 'first'
    await reader.cancel('client disconnected');

    expect(onFlush).not.toHaveBeenCalled();
  });
});
