import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { IsString } from "class-validator";

@ApiSchema({ name: "PortPreviewUrl" })
export class PortPreviewUrlDto {
  @ApiProperty({
    description: "Preview url",
    example: "https://123456-mysandbox.executor.com",
  })
  @IsString()
  url: string;

  @ApiProperty({
    description: "Access token",
    example: "ul67qtv-jl6wb9z5o3eii-ljqt9qed6l",
    required: false,
  })
  @IsString()
  token?: string;

  @ApiProperty({
    description: "Legacy preview url using executor domain",
    example: "https://3000-mysandbox.executor.com",
    required: false,
  })
  @IsString()
  legacyProxyUrl?: string;
}
