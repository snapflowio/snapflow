export class ExecutorNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutorNotReadyError";
  }
}
