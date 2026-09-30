/**
 * Features that are still simulated in the browser (no backend behind them). They stay hidden
 * until a real implementation exists; flip a flag only once its backend is in place.
 */
export const FEATURES = {
  /** Odivon AI salon assistant: replies are canned keyword matches, not a real model. */
  aiAssistant: false,
  /** Demo/simulation controls: role preview, "simulate expired" toggle, turnstile scan from the QR modal. */
  simulations: false,
} as const;
