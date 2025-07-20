import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ExecutorRegion } from "../enums/executor-region.enum";
import { ExecutorState } from "../enums/executor-state.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";

@Entity()
export class Executor {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  domain: string;

  @Column()
  apiUrl: string;

  @Column()
  apiKey: string;

  @Column()
  cpu: number;

  @Column()
  memory: number;

  @Column()
  disk: number;

  @Column()
  gpu: number;

  @Column()
  gpuType: string;

  @Column({
    type: "enum",
    enum: SandboxClass,
    default: SandboxClass.SMALL,
  })
  class: SandboxClass;

  @Column({
    default: 0,
  })
  used: number;

  @Column()
  capacity: number;

  @Column({
    type: "enum",
    enum: ExecutorRegion,
  })
  region: ExecutorRegion;

  @Column({
    type: "enum",
    enum: ExecutorState,
    default: ExecutorState.INITIALIZING,
  })
  state: ExecutorState;

  @Column({
    nullable: true,
  })
  lastChecked: Date;

  @Column({
    default: false,
  })
  unschedulable: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
