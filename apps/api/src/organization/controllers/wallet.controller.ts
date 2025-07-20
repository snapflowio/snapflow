import { Controller } from "@nestjs/common";
import { ApiBearerAuth, ApiOAuth2, ApiTags } from "@nestjs/swagger";
import { OrganizationUserService } from "../services/organization-user.service";

@ApiTags("organization")
@Controller("organizations/:organizationId/wallet")
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class OrganizationWallet {
  constructor(private readonly organizationUserService: OrganizationUserService) {}
}
