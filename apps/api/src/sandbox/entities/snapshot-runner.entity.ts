import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { SnapshotRunnerState } from "../enums/snapshot-runner-state.enum";

@Entity()
export class SnapshotRunner {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: SnapshotRunnerState,
    default: SnapshotRunnerState.PULLING_SNAPSHOT,
  })
  state: SnapshotRunnerState;

  @Column({ nullable: true })
  errorReason?: string;

  @Column({
    default: "",
  })
  snapshotRef: string;

  @Column()
  runnerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
