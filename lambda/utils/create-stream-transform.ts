export const createStreamTransform = <T>(
  stream: ReadableStream<T>,
  onFlush: (chunks: Array<T>) => void | Promise<void>,
): ReadableStream<T> => {
  const chunks: Array<T> = [];

  return stream.pipeThrough(
    new TransformStream<T, T>({
      transform(chunk: T, controller): void {
        chunks.push(chunk);
        controller.enqueue(chunk);
      },

      async flush(): Promise<void> {
        try {
          await onFlush(chunks);
        } catch {
          // Swallow errors: observability failures must never
          // break the stream pipeline reaching the client.
        }
      },
    }),
  );
};
