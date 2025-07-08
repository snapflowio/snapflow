import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const DockerRegistry = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.dockerRegistry;
  },
);
