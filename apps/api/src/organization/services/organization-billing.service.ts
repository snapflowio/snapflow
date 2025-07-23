import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Polar } from "@polar-sh/sdk";
import { CheckoutLink } from "@polar-sh/sdk/models/components/checkoutlink.js";
import { Repository } from "typeorm";
import { TypedConfigService } from "../../config/typed-config.service";
import { CreateOrganizationCheckoutDto } from "../dto/create-organization-checkout.dto";
import { Organization } from "../entities/organization.entity";

const POLAR_PAYMENT_TIMEOUT = 5000; // In milliseconds

@Injectable()
export class OrganizationBillingService implements OnModuleInit {
  private readonly logger = new Logger(OrganizationBillingService.name);
  private polar: Polar;

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly configService: TypedConfigService
  ) {}

  onModuleInit() {
    this.polar = new Polar({
      accessToken: this.configService.get("polarAccessKey"),
      timeoutMs: POLAR_PAYMENT_TIMEOUT,
      server: this.configService.get("environment") === "prod" ? "production" : "sandbox",
    });
  }

  async getCheckoutLink(
    organizationId: string,
    createOrganizationCheckoutDto: CreateOrganizationCheckoutDto
  ): Promise<CheckoutLink> {
    return this.polar.checkoutLinks.create({
      paymentProcessor: "stripe",
      metadata: {
        organizationId,
      },
      productId: createOrganizationCheckoutDto.productId,
    });
  }
}
