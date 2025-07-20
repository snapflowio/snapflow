import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { SystemRole } from "../../user/enums/system-role.enum";
import { Image } from "../entities/image.entity";
import { ImageService } from "../services/image.service";

@Injectable()
export class ImageAccessGuard implements CanActivate {
  constructor(private readonly imageService: ImageService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const imageId: string = request.params.imageId || request.params.id;
    const authContext: OrganizationAuthContext = request.user;

    let image: Image;

    try {
      image = await this.imageService.getImage(imageId);
    } catch (error) {
      image = await this.imageService.getImageByName(imageId, authContext.organizationId);
    }

    if (
      authContext.role !== SystemRole.ADMIN &&
      image.organizationId !== authContext.organizationId
    ) {
      throw new ForbiddenException(
        "Request organization ID does not match resource organization ID"
      );
    }

    request.image = image;
    return true;
  }
}
