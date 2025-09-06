import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

@ApiSchema({ name: "WorkspaceSuspension" })
export class WorkspaceSuspensionDto {
  @ApiProperty({
    description: "Suspension reason",
  })
  reason: string;

  @ApiProperty({
    description: "Suspension until",
  })
  @IsOptional()
  until?: Date;
}
