import { Column, Entity, PrimaryColumn } from "typeorm";
import { SystemRole } from "./enums/system-role.enum";

export interface UserPublicKey {
  key: string;
  name: string;
}

@Entity()
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({
    default: "",
  })
  email: string;

  @Column({
    default: "",
  })
  password: string;

  @Column({
    default: false,
  })
  emailVerified: boolean;

  @Column({
    type: "enum",
    enum: SystemRole,
    default: SystemRole.USER,
  })
  role: SystemRole;
}
