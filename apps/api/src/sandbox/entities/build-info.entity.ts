import { createHash } from "crypto";
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Image } from "./image.entity";
import { Sandbox } from "./sandbox.entity";

export function generateBuildInfoHash(
  dockerfileContent: string,
  contextHashes: string[] = []
): string {
  const sortedContextHashes = [...contextHashes].sort() || [];
  const combined = dockerfileContent + sortedContextHashes.join("");
  const hash = createHash("sha256").update(combined).digest("hex");
  return `snapflow-${hash}:snapflow`;
}

@Entity()
export class BuildInfo {
  @PrimaryColumn()
  imageRef: string;

  @Column({ type: "text", nullable: true })
  dockerfileContent?: string;

  @Column("simple-array", { nullable: true })
  contextHashes?: string[];

  @OneToMany(
    () => Image,
    (image) => image.buildInfo
  )
  images: Relation<Image[]>;

  @OneToMany(
    () => Sandbox,
    (sandbox) => sandbox.buildInfo
  )
  sandboxes: Relation<Sandbox[]>;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateHash() {
    this.imageRef = generateBuildInfoHash(this.dockerfileContent, this.contextHashes);
  }
}
