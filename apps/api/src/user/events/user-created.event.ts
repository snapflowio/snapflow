import { EntityManager } from "typeorm";
import { CreateOrganizationQuotaDto } from "../../organization/dto/create-organization-quota.dto";

export class UserCreatedEvent {
  constructor(
    public readonly entityManager: EntityManager,
    public readonly userId: string,
    public readonly email?: string,
    public readonly emailVerified?: boolean,
    public readonly personalOrganizationQuota?: CreateOrganizationQuotaDto,
  ) {}
}
