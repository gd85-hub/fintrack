export type PreparedPdfLifecycle<T> = {
  begin(): number;
  accept(generation: number, prepared: T): boolean;
  current(): T | null;
  invalidate(): void;
};

export function createPreparedPdfLifecycle<T>(
  dispose: (prepared: T) => void,
): PreparedPdfLifecycle<T> {
  let generation = 0;
  let prepared: T | null = null;

  const replace = (next: T | null): void => {
    if (prepared && prepared !== next) {
      dispose(prepared);
    }
    prepared = next;
  };

  return {
    begin() {
      generation += 1;
      replace(null);
      return generation;
    },
    accept(candidateGeneration, candidate) {
      if (candidateGeneration !== generation) {
        dispose(candidate);
        return false;
      }
      replace(candidate);
      return true;
    },
    current() {
      return prepared;
    },
    invalidate() {
      generation += 1;
      replace(null);
    },
  };
}
