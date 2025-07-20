import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ImageExecutorState } from "../enums/image-executor-state.enum";

@Entity()
export class ImageExecutor {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: ImageExecutorState,
    default: ImageExecutorState.PULLING_IMAGE,
  })
  state: ImageExecutorState;

  @Column({ nullable: true })
  errorReason?: string;

  @Column({
    default: "",
  })
  imageRef: string;

  @Column()
  executorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
