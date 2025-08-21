import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { OrganizationMemberRole } from "../enums/organization-member-role.enum";
import { Organization } from "./organization.entity";
import { OrganizationRole } from "./organization-role.entity";

@Entity()
export class OrganizationUser {
  @PrimaryColumn()
  organizationId: string;

  @PrimaryColumn()
  userId: string;

  @Column({
    type: "enum",
    enum: OrganizationMemberRole,
    default: OrganizationMemberRole.MEMBER,
  })
  role: OrganizationMemberRole;

  @ManyToOne(
    () => Organization,
    (organization) => organization.users,
    {
      onDelete: "CASCADE",
    }
  )
  @JoinColumn({ name: "organizationId" })
  organization: Relation<Organization>;

  @ManyToMany(
    () => OrganizationRole,
    (role) => role.users,
    {
      cascade: true,
      onDelete: "CASCADE",
    }
  )
  @JoinTable({
    name: "organization_role_assignment",
    joinColumns: [
      { name: "organizationId", referencedColumnName: "organizationId" },
      { name: "userId", referencedColumnName: "userId" },
    ],
    inverseJoinColumns: [{ name: "roleId", referencedColumnName: "id" }],
  })
  assignedRoles: Relation<OrganizationRole[]>;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}
