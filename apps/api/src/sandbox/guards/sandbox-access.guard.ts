import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { SystemRole } from "../../user/enums/system-role.enum";
import { SandboxService } from "../services/sandbox.service";

@Injectable()
export class SandboxAccessGuard implements CanActivate {
  constructor(private readonly sandboxService: SandboxService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sandboxId: string =
      request.params.sandboxId || request.params.id || request.params.workspaceId;

    const authContext: OrganizationAuthContext = request.user;

    try {
      const sandbox = await this.sandboxService.findOne(sandboxId, true);
      if (
        authContext.role !== SystemRole.ADMIN &&
        sandbox.organizationId !== authContext.organizationId
      ) {
        throw new ForbiddenException(
          "Request organization ID does not match resource organization ID"
        );
      }

      request.sandbox = sandbox;
      return true;
    } catch (error) {
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }
  }
}
