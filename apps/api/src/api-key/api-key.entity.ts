import { Column, Entity, PrimaryColumn } from "typeorm";
import { OrganizationResourcePermission } from "../organization/enums/organization-resource-permission.enum";

/**
 * Represents a stored API key associated with a user in an organization.
 * The entity uses a composite primary key of `organizationId`, `userId`, and `name`.
 */
@Entity()
export class ApiKey {
  /**
   * The UUID of the organization this API key belongs to.
   * Part of the composite primary key.
   */
  @PrimaryColumn({ type: "uuid" })
  organizationId: string;

  /**
   * The ID of the user who owns this API key.
   * Part of the composite primary key.
   */
  @PrimaryColumn()
  userId: string;

  /**
   * A user-provided, unique name for the API key within the user's scope.
   * Part of the composite primary key.
   */
  @PrimaryColumn()
  name: string;

  /**
   * The SHA-256 hash of the API key. The raw key is never stored.
   */
  @Column({ unique: true, nullable: false })
  keyHash: string;

  /**
   * The first few characters of the API key, used for display purposes.
   */
  @Column({ nullable: false })
  keyPrefix: string;

  /**
   * The last few characters of the API key, used for display purposes.
   */
  @Column({ nullable: false })
  keySuffix: string;

  /**
   * An array of permissions granted to this API key.
   * These permissions are a subset of the owner's permissions.
   */
  @Column({
    type: "enum",
    enum: OrganizationResourcePermission,
    array: true,
  })
  permissions: OrganizationResourcePermission[];

  /**
   * The timestamp when the API key was created.
   */
  @Column()
  createdAt: Date;

  /**
   * The timestamp when the API key was last used. Null if never used.
   */
  @Column({ nullable: true })
  lastUsedAt?: Date;

  /**
   * The timestamp when the API key expires. Null if it never expires.
   */
  @Column({ nullable: true })
  expiresAt?: Date;
}
