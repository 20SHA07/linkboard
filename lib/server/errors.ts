/** Errors safe to return to the caller. Internal exceptions are never serialized. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
