import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { OrganizationResourcePermission } from "../enums/organization-resource-permission.enum";
import { Organization } from "./organization.entity";
import { OrganizationInvitation } from "./organization-invitation.entity";
import { OrganizationUser } from "./organization-user.entity";

@Entity()
export class OrganizationRole {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({
    type: "enum",
    enum: OrganizationResourcePermission,
    array: true,
  })
  permissions: OrganizationResourcePermission[];

  @Column({ default: false })
  isGlobal: boolean;

  @Column({
    nullable: true,
  })
  organizationId?: string;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organizationId" })
  organization: Relation<Organization>;

  @ManyToMany(
    () => OrganizationUser,
    (user) => user.assignedRoles
  )
  users: Relation<OrganizationUser[]>;

  @ManyToMany(
    () => OrganizationInvitation,
    (invitation) => invitation.assignedRoles
  )
  invitations: Relation<OrganizationInvitation[]>;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}
