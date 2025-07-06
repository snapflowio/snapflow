import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { SystemRole } from "../../user/enums/system-role.enum";
import { DockerRegistryService } from "../docker-registry.service";

@Injectable()
export class DockerRegistryAccessGuard implements CanActivate {
  constructor(private readonly dockerRegistryService: DockerRegistryService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const dockerRegistryId: string =
      request.params.dockerRegistryId || request.params.registryId || request.params.id;

    const authContext: OrganizationAuthContext = request.user;

    try {
      const dockerRegistry = await this.dockerRegistryService.findOneOrFail(dockerRegistryId);
      if (
        authContext.role !== SystemRole.ADMIN &&
        dockerRegistry.organizationId !== authContext.organizationId
      )
        throw new ForbiddenException(
          "Request organization ID does not match resource organization ID"
        );

      request.dockerRegistry = dockerRegistry;
      return true;
    } catch (error) {
      throw new NotFoundException(`Docker registry with ID ${dockerRegistryId} not found`);
    }
  }
}
