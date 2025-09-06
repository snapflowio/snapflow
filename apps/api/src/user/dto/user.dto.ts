import { ApiProperty, ApiSchema } from "@nestjs/swagger";

import { User } from "../../database/schema";

@ApiSchema({ name: "User" })
export class UserDto {
  @ApiProperty({
    description: "User ID",
  })
  id: string;

  @ApiProperty({
    description: "User name",
  })
  name: string;

  @ApiProperty({
    description: "User email",
  })
  email: string;

  static fromUser(user: User): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    } as UserDto;
  }
}
