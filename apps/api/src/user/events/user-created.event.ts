import type { PrismaClient } from "@prisma/client";
import { CreateOrganizationQuotaDto } from "../../organization/dto/create-organization-quota.dto";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export class UserCreatedEvent {
  constructor(
    public readonly prisma: PrismaTransaction,
    public readonly userId: string,
    public readonly email?: string,
    public readonly emailVerified?: boolean,
    public readonly personalOrganizationQuota?: CreateOrganizationQuotaDto
  ) {}
}
