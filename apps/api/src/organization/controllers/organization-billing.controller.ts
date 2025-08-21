import { Body, Controller, Get, Param, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOAuth2, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequiredOrganizationMemberRole } from "../decorators/required-organization-member-role.decorator";
import { CreateOrganizationCheckoutDto } from "../dto/create-organization-checkout.dto";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";
import { OrganizationActionGuard } from "../guards/organization-action.guard";
import { OrganizationBillingService } from "../services/organization-billing.service";

@ApiTags("organizations")
@Controller("organizations/:organizationId/billing")
@UseGuards(AuthGuard("jwt"), OrganizationActionGuard)
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class OrganizationBillingController {
  constructor(private readonly organizationBillingService: OrganizationBillingService) {}

  @Get("/checkout")
  @ApiOperation({
    summary: "Get payment checkout link",
    operationId: "createCheckoutLink",
  })
  @RequiredOrganizationMemberRole(OrganizationMemberRole.OWNER)
  async createCheckoutLink(
    @Param("organizationId") organizationId: string,
    @Body() createOrganizationCheckoutDto: CreateOrganizationCheckoutDto
  ) {
    return await this.organizationBillingService.getCheckoutLink(
      organizationId,
      createOrganizationCheckoutDto
    );
  }
}
