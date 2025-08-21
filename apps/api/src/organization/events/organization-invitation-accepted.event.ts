import { EntityManager } from "typeorm";
import { OrganizationRole } from "../entities/organization-role.entity";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";

export class OrganizationInvitationAcceptedEvent {
  constructor(
    public readonly entityManager: EntityManager,
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly role: OrganizationMemberRole,
    public readonly assignedRoles: OrganizationRole[]
  ) {}
}
