import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Polar } from "@polar-sh/sdk";
import { CheckoutLink } from "@polar-sh/sdk/models/components/checkoutlink.js";
import { TypedConfigService } from "../../config/typed-config.service";
import { CreateOrganizationCheckoutDto } from "../dto/create-organization-checkout.dto";

const POLAR_PAYMENT_TIMEOUT = 5000; // In milliseconds

@Injectable()
export class OrganizationBillingService implements OnModuleInit {
  private readonly logger = new Logger(OrganizationBillingService.name);
  private polar: Polar;

  constructor(private readonly configService: TypedConfigService) {}

  onModuleInit() {
    this.polar = new Polar({
      accessToken: this.configService.get("polar.accessToken"),
      timeoutMs: POLAR_PAYMENT_TIMEOUT,
      server: this.configService.get("environment") === "production" ? "production" : "sandbox",
    });
  }

  async getCheckoutLink(
    organizationId: string,
    createOrganizationCheckoutDto: CreateOrganizationCheckoutDto
  ): Promise<CheckoutLink> {
    const checkout = await this.polar.checkoutLinks.create({
      paymentProcessor: "stripe",
      metadata: {
        organizationId,
      },
      productId: createOrganizationCheckoutDto.productId,
    });

    return checkout;
  }
}
