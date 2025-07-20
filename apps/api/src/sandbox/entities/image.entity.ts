import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { ImageState } from "../enums/image-state.enum";
import { BuildInfo } from "./build-info.entity";
import { ImageExecutor } from "./image-executor.entity";

@Entity()
@Unique(["organizationId", "name"])
export class Image {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    nullable: true,
    type: "uuid",
  })
  organizationId?: string;

  @Column({ default: false })
  general: boolean;

  @Column()
  name: string;

  @Column()
  imageName: string;

  @Column({ nullable: true })
  internalName?: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({
    type: "enum",
    enum: ImageState,
    default: ImageState.PENDING,
  })
  state: ImageState;

  @Column({ nullable: true })
  errorReason?: string;

  @Column({ type: "float", nullable: true })
  size?: number;

  @Column({ type: "int", default: 1 })
  cpu: number;

  @Column({ type: "int", default: 0 })
  gpu: number;

  @Column({ type: "int", default: 1 })
  mem: number;

  @Column({ type: "int", default: 3 })
  disk: number;

  @Column({ default: false })
  hideFromUsers: boolean;

  @OneToMany(
    () => ImageExecutor,
    (executor) => executor.imageRef
  )
  executors: ImageExecutor[];

  @Column({ array: true, type: "text", nullable: true })
  entrypoint?: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastUsedAt?: Date;

  @ManyToOne(
    () => BuildInfo,
    (buildInfo) => buildInfo.images,
    {
      nullable: true,
      eager: true,
    }
  )
  @JoinColumn()
  buildInfo?: BuildInfo;

  @Column({ nullable: true })
  buildExecutorId?: string;
}
