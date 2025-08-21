import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Represents a specific period of resource usage for a sandbox.
 * This entity logs resource consumption (CPU, GPU, memory, disk) over time.
 */
@Entity("sandbox_usage_periods")
export class SandboxUsagePeriod {
  /**
   * The unique identifier for the usage period record.
   */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * The ID of the sandbox this usage period belongs to.
   */
  @Column()
  sandboxId: string;

  /**
   * The ID of the organization that owns the sandbox.
   */
  @Column()
  organizationId: string;

  /**
   * The timestamp when this usage period started.
   */
  @Column({ type: "timestamp" })
  startAt: Date;

  /**
   * The timestamp when this usage period ended.
   * A null value indicates that the period is currently active.
   */
  @Column({ type: "timestamp", nullable: true })
  endAt: Date | null;

  /**
   * The amount of CPU allocated during this period.
   */
  @Column({ type: "float" })
  cpu: number;

  /**
   * The amount of GPU allocated during this period.
   */
  @Column({ type: "float" })
  gpu: number;

  /**
   * The amount of memory (in GB or a similar unit) allocated during this period.
   */
  @Column({ type: "float" })
  mem: number;

  /**
   * The amount of disk space (in GB or a similar unit) allocated during this period.
   */
  @Column({ type: "float" })
  disk: number;

  /**
   * The geographic region where the sandbox is hosted.
   */
  @Column()
  region: string;

  /**
   * Tracks whether this usage period has been billed.
   * Prevents double billing of the same period.
   */
  @Column({ type: "boolean", default: false })
  billed: boolean;

  /**
   * A factory method to create a new SandboxUsagePeriod instance from an existing one.
   * This is useful for creating a subsequent usage period record from a closed one.
   * @param usagePeriod - The source usage period to copy properties from.
   * @returns A new SandboxUsagePeriod instance with properties copied from the source.
   */
  public static fromUsagePeriod(usagePeriod: SandboxUsagePeriod): SandboxUsagePeriod {
    // Use Object.assign to create a shallow copy of the entity.
    // We then unset the 'id' so TypeORM treats it as a new entity.
    const newUsagePeriodEntity = Object.assign(new SandboxUsagePeriod(), usagePeriod);
    (newUsagePeriodEntity as Partial<SandboxUsagePeriod>).id = undefined;

    return newUsagePeriodEntity;
  }
}
