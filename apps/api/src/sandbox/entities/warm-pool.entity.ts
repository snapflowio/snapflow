import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ExecutorRegion } from "../enums/executor-region.enum";
import { SandboxClass } from "../enums/sandbox-class.enum";

@Entity()
export class WarmPool {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  pool: number;

  @Column()
  image: string;

  @Column({
    type: "enum",
    enum: ExecutorRegion,
    default: ExecutorRegion.EU,
  })
  target: ExecutorRegion;

  @Column()
  cpu: number;

  @Column()
  mem: number;

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

  @Column()
  osUser: string;

  @Column({ nullable: true })
  errorReason?: string;

  @Column({
    type: "simple-json",
    default: {},
  })
  env: { [key: string]: string };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
