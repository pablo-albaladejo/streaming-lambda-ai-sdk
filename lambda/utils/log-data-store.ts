export type LlmLogData =
  | {
      llmParam: Record<PropertyKey, unknown>;
      llmResult: Record<PropertyKey, unknown>;
    }
  | undefined;

export type LlmLogDataStore = {
  clear: () => void;
  get: () => LlmLogData;
  set: (data: LlmLogData) => void;
};

export const createLlmLogDataStore = (): LlmLogDataStore => {
  const storage = new Map<string, LlmLogData>();
  const KEY = 'llmLogData';

  return {
    clear: (): void => {
      storage.clear();
    },
    get: (): LlmLogData => storage.get(KEY),
    set: (data: LlmLogData): void => {
      storage.set(KEY, data);
    },
  };
};

export const llmLogDataStore = createLlmLogDataStore();
