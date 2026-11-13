import type { MessageKey } from './i18n/locales/en';

export type ErrorCode = Extract<MessageKey, `err.${string}`>;
export type ErrorParams = Record<string, string | number>;

/** An error whose message is translated in the UI via its code. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly params: ErrorParams;

  constructor(code: ErrorCode, params: ErrorParams = {}) {
    super(`${code} ${JSON.stringify(params)}`);
    this.name = 'AppError';
    this.code = code;
    this.params = params;
  }
}
