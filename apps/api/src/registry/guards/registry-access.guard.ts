import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { SystemRole } from "../../user/enums/system-role.enum";
import { RegistryService } from "../registry.service";

@Injectable()
export class RegistryAccessGuard implements CanActivate {
  constructor(private readonly registryService: RegistryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const registryId: string =
      request.params.registryId || request.params.registryId || request.params.id;

    const authContext: OrganizationAuthContext = request.user;

    try {
      const registry = await this.registryService.findOneOrFail(registryId);
      if (
        authContext.role !== SystemRole.ADMIN &&
        registry.organizationId !== authContext.organizationId
      )
        throw new ForbiddenException(
          "Request organization ID does not match resource organization ID"
        );

      request.registry = registry;
      return true;
    } catch (error) {
      throw new NotFoundException(`Docker registry with ID ${registryId} not found`);
    }
  }
}
