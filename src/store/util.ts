export type Updater<T> = T | ((prev: T) => T);
export type Setter<T> = (value: Updater<T>) => void;

export function resolveUpdater<T>(value: Updater<T>, prev: T): T {
  return typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
}

type ZustandSet<S> = (partial: (state: S) => Partial<S>) => void;

/** Builds a React-like `setX(value | updater)` function for one field of a Zustand store. */
export function fieldSetter<S, K extends keyof S>(set: ZustandSet<S>, key: K): Setter<S[K]> {
  return (value) => set((state) => ({ [key]: resolveUpdater(value, state[key]) }) as unknown as Partial<S>);
}
