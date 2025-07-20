import { HttpException, HttpStatus } from "@nestjs/common";

export class ForbiddenOperationError extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.FORBIDDEN);
  }
}
