export class SnapflowError extends Error {
  public static fromError(error: Error): SnapflowError {
    if (String(error).includes("Organization is suspended")) {
      return new OrganizationSuspendedError(error.message);
    }

    return new SnapflowError(error.message);
  }

  public static fromString(error: string): SnapflowError {
    return SnapflowError.fromError(new Error(error));
  }
}

export class OrganizationSuspendedError extends SnapflowError {}
