import { createHash } from "crypto";
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { Sandbox } from "./sandbox.entity";
import { Snapshot } from "./snapshot.entity";

export function generateBuildInfoHash(
  dockerfileContent: string,
  contextHashes: string[] = [],
): string {
  const sortedContextHashes = [...contextHashes].sort() || [];
  const combined = dockerfileContent + sortedContextHashes.join("");
  const hash = createHash("sha256").update(combined).digest("hex");
  return `snapflow-${hash}:snapflow`;
}

@Entity()
export class BuildInfo {
  @PrimaryColumn()
  snapshotRef: string;

  @Column({ type: "text", nullable: true })
  dockerfileContent?: string;

  @Column("simple-array", { nullable: true })
  contextHashes?: string[];

  @OneToMany(() => Snapshot, (snapshot) => snapshot.buildInfo)
  snapshots: Snapshot[];

  @OneToMany(() => Sandbox, (sandbox) => sandbox.buildInfo)
  sandboxes: Sandbox[];

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateHash() {
    this.snapshotRef = generateBuildInfoHash(
      this.dockerfileContent,
      this.contextHashes,
    );
  }
}
