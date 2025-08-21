import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Relation } from "typeorm";
import { OrganizationInvitation } from "./organization-invitation.entity";
import { OrganizationRole } from "./organization-role.entity";
import { OrganizationUser } from "./organization-user.entity";

@Entity()
export class Organization {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  createdBy: string;

  @Column({
    default: false,
  })
  personal: boolean;

  @Column({
    type: "decimal",
    default: "0.000000",
    precision: 12,
    scale: 6,
    name: "wallet",
  })
  wallet: string;

  @Column({
    default: true,
  })
  telemetryEnabled: boolean;

  @Column({
    type: "int",
    default: 10,
    name: "total_cpu_quota",
  })
  totalCpuQuota: number;

  @Column({
    type: "int",
    default: 10,
    name: "total_memory_quota",
  })
  totalMemoryQuota: number;

  @Column({
    type: "int",
    default: 30,
    name: "total_disk_quota",
  })
  totalDiskQuota: number;

  @Column({
    type: "int",
    default: 4,
    name: "max_cpu_per_sandbox",
  })
  maxCpuPerSandbox: number;

  @Column({
    type: "int",
    default: 8,
    name: "max_memory_per_sandbox",
  })
  maxMemoryPerSandbox: number;

  @Column({
    type: "int",
    default: 10,
    name: "max_disk_per_sandbox",
  })
  maxDiskPerSandbox: number;

  @Column({
    type: "int",
    default: 20,
    name: "max_image_size",
  })
  maxImageSize: number;

  @Column({
    type: "int",
    default: 100,
    name: "image_quota",
  })
  imageQuota: number;

  @Column({
    type: "int",
    default: 100,
    name: "bucket_quota",
  })
  bucketQuota: number;

  @OneToMany(
    () => OrganizationRole,
    (organizationRole) => organizationRole.organization,
    {
      cascade: true,
      onDelete: "CASCADE",
    }
  )
  roles: Relation<OrganizationRole[]>;

  @OneToMany(
    () => OrganizationUser,
    (user) => user.organization,
    {
      cascade: true,
      onDelete: "CASCADE",
    }
  )
  users: Relation<OrganizationUser[]>;

  @OneToMany(
    () => OrganizationInvitation,
    (invitation) => invitation.organization,
    {
      cascade: true,
      onDelete: "CASCADE",
    }
  )
  invitations: Relation<OrganizationInvitation[]>;

  @Column({
    default: false,
  })
  suspended: boolean;

  @Column({
    nullable: true,
    type: "timestamp",
  })
  suspendedAt?: Date;

  @Column({
    nullable: true,
  })
  suspensionReason?: string;

  @Column({
    nullable: true,
    type: "timestamp",
  })
  suspendedUntil?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn()
  updatedAt: Date;
}
