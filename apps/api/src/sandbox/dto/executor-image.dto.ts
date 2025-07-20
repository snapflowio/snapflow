import { ApiProperty } from "@nestjs/swagger";

export class ExecutorImageDto {
  @ApiProperty({
    description: "Executor image ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  executorImageId: string;

  @ApiProperty({
    description: "Executor ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  executorId: string;

  @ApiProperty({
    description: "Executor domain",
    example: "executor.example.com",
  })
  executorDomain: string;

  constructor(executorImageId: string, executorId: string, executorDomain: string) {
    this.executorImageId = executorImageId;
    this.executorId = executorId;
    this.executorDomain = executorDomain;
  }
}
