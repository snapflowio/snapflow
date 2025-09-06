import { ApiProperty, ApiSchema } from "@nestjs/swagger";
import { Workspace } from "../../database/schema";

@ApiSchema({ name: "Workspace" })
export class WorkspaceDto {
  @ApiProperty({
    description: "Module ID",
  })
  id: string;

  @ApiProperty({
    description: "The id of the module creator",
  })
  userId: string;

  @ApiProperty({
    description: "Module name",
  })
  name: string;

  @ApiProperty({
    description: "A code for a class",
  })
  classCode: string;

  @ApiProperty({
    description: "The color of the workspace",
  })
  color: string;

  @ApiProperty({
    description: "Creation timestamp",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
  })
  updatedAt: Date;

  static fromWorkspace(workspace: Workspace): WorkspaceDto {
    return {
      id: workspace.id,
      userId: workspace.userId,
      name: workspace.name,
      color: workspace.color,
      classCode: workspace.classCode,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
