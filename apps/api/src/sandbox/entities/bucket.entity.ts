import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { BucketState } from "../enums/bucket-state.enum";

@Entity()
@Unique(["organizationId", "name"])
export class Bucket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    nullable: true,
    type: "uuid",
  })
  organizationId?: string;

  @Column()
  name: string;

  @Column({
    type: "enum",
    enum: BucketState,
    default: BucketState.PENDING_CREATE,
  })
  state: BucketState;

  @Column({ nullable: true })
  errorReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastUsedAt?: Date;

  public getBucketName(): string {
    return `snapflow-bucket-${this.id}`;
  }
}
