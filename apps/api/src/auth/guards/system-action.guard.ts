import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  RequiredApiRole,
  RequiredSystemRole,
} from "../../common/decorators/required-role.decorator";
import {
  ApiRole,
  AuthContext,
} from "../../common/interfaces/auth-context.interface";
import { SystemRole } from "../../user/enums/system-role.enum";

@Injectable()
export class SystemActionGuard implements CanActivate {
  protected readonly logger = new Logger(SystemActionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authContext: AuthContext = request.user;

    let requiredRole: SystemRole | SystemRole[] | ApiRole | ApiRole[] =
      this.reflector.get(RequiredSystemRole, context.getHandler()) ||
      this.reflector.get(RequiredSystemRole, context.getClass());

    if (!requiredRole) {
      requiredRole =
        this.reflector.get(RequiredApiRole, context.getHandler()) ||
        this.reflector.get(RequiredApiRole, context.getClass());
      if (!requiredRole) return true;
    }

    if (!Array.isArray(requiredRole)) requiredRole = [requiredRole];

    return (requiredRole as string[]).includes(authContext.role as string);
  }
}
