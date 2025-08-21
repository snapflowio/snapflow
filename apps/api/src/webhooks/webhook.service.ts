import { Injectable } from "@nestjs/common";
import { Order } from "@polar-sh/sdk/models/components/order.js";
import { Organization } from "../organization/entities/organization.entity";
import { OrganizationService } from "../organization/services/organization.service";

@Injectable()
export class WebhookService {
  constructor(private readonly organizationSerivce: OrganizationService) {}

  async processBillingWebhook(order: Order): Promise<Organization> {
    const organizationId = order.metadata.organizationId as string;
    return await this.organizationSerivce.updateWalletCredit(organizationId, order.totalAmount);
  }
}
