import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { Organization } from "../entities/organization.entity";

@ApiSchema({ name: "Organization" })
export class OrganizationDto {
  @ApiProperty({
    description: "Organization ID",
  })
  id: string;

  @ApiProperty({
    description: "Organization name",
  })
  name: string;

  @ApiProperty({
    description: "The id of the organization creator",
  })
  createdBy: string;

  @ApiProperty({
    description: "Personal organization flag",
  })
  personal: boolean;

  @ApiProperty({
    description: "Creation timestamp",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
  })
  updatedAt: Date;

  @ApiProperty({
    description: "Suspended flag",
  })
  suspended: boolean;

  @ApiProperty({
    description: "Suspended at",
  })
  suspendedAt?: Date;

  @ApiProperty({
    description: "Suspended reason",
  })
  suspensionReason?: string;

  @ApiProperty({
    description: "Suspended until",
  })
  suspendedUntil?: Date;

  static fromOrganization(organization: Organization): OrganizationDto {
    return {
      id: organization.id,
      name: organization.name,
      createdBy: organization.createdBy,
      personal: organization.personal,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      suspended: organization.suspended,
      suspensionReason: organization.suspensionReason,
      suspendedAt: organization.suspendedAt,
      suspendedUntil: organization.suspendedUntil,
    };
  }
}
