import { beforeAll } from "bun:test";

// Suppress React act() warnings in tests
// These warnings occur when state updates happen outside of act(),
// which is common with async useEffect hooks
beforeAll(() => {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() ?? "";
    if (message.includes("was not wrapped in act") || message.includes("wrapped into act")) {
      return;
    }
    originalError.apply(console, args);
  };
});
