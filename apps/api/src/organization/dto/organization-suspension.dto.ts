import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

@ApiSchema({ name: "OrganizationSuspension" })
export class OrganizationSuspensionDto {
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
