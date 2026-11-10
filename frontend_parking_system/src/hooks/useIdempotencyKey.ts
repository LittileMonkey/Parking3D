import { useCallback, useState } from "react";

type IdempotencyKeyState = {
  prefix: string;
  key: string;
};

export function useIdempotencyKey(prefix = "") {
  const generate = useCallback(() => {
    const raw = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return prefix ? `${prefix}-${raw}` : raw;
  }, [prefix]);

  const [keyState, setKeyState] = useState<IdempotencyKeyState>(() => ({
    prefix,
    key: generate(),
  }));
  let currentState = keyState;

  if (keyState.prefix !== prefix) {
    currentState = { prefix, key: generate() };
    setKeyState(currentState);
  }

  const renewKey = useCallback(() => {
    const nextState = { prefix, key: generate() };
    setKeyState(nextState);
    return nextState.key;
  }, [generate, prefix]);

  return { key: currentState.key, renewKey };
}
