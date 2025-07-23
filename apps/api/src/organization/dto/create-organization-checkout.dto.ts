import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsString, IsUUID } from "class-validator";

@ApiSchema({ name: "CreateOrganizationCheckout" })
export class CreateOrganizationCheckoutDto {
  @ApiProperty({
    description: "The product ID of the subscription that is being purchased",
    example: "d13c586c-ce41-4673-8917-0043c0a22867",
    required: true,
  })
  @IsUUID()
  @IsString()
  productId: string;
}
