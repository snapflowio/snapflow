import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const Sandbox = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.sandbox;
  },
);
