export class SnapflowError extends Error {
  public override readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'SnapflowError'
    this.cause = cause
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SnapflowError)
    }
  }
}