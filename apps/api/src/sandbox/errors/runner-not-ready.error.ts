export class RunnerNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunnerNotReadyError";
  }
}
