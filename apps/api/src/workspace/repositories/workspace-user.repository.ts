import { and, count, eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import { Repository } from "../../database/decorators/repository.decorator";
import { BaseRepository } from "../../database/repositories/base.repository";
import { WorkspaceUser, NewWorkspaceUser, workspaceUser } from "../../database/schema";
import { WorkspaceMemberRole } from "../enums/workspace-member-role.enum";

@Repository("WorkspaceUser")
export class WorkspaceUserRepository extends BaseRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService.db);
  }

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceUser[]> {
    return this.db.query.workspaceUser.findMany({
      where: eq(workspaceUser.workspaceId, workspaceId),
    });
  }

  async findByUserId(userId: string): Promise<WorkspaceUser[]> {
    return this.db.query.workspaceUser.findMany({
      where: eq(workspaceUser.userId, userId),
    });
  }

  async findSpecific(workspaceId: string, userId: string): Promise<WorkspaceUser | null> {
    return this.db.query.workspaceUser.findFirst({
      where: and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)),
    });
  }

  async countByWorkspaceIdAndRole(
    workspaceId: string,
    role: WorkspaceMemberRole
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(workspaceUser)
      .where(and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.role, role)));

    return result[0]?.count || 0;
  }

  async create(data: NewWorkspaceUser): Promise<WorkspaceUser> {
    const result = await this.db.insert(workspaceUser).values(data).returning();
    return result[0];
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole
  ): Promise<WorkspaceUser> {
    const result = await this.db
      .update(workspaceUser)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)))
      .returning();

    return result[0];
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(workspaceUser)
      .where(and(eq(workspaceUser.workspaceId, workspaceId), eq(workspaceUser.userId, userId)));
  }
}
