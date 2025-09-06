import { and, count, eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import { Repository } from "../../database/decorators/repository.decorator";
import { BaseRepository } from "../../database/repositories/base.repository";
import { NewWorkspace, Workspace, workspace } from "../../database/schema";

@Repository("Workspace")
export class WorkspaceRepository extends BaseRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService.db);
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.db.query.workspace.findFirst({
      where: eq(workspace.id, id),
    });
  }

  async findSpecific(userId: string, workspaceId: string): Promise<Workspace | null> {
    return this.db.query.workspace.findFirst({
      where: and(eq(workspace.userId, userId), eq(workspace.id, workspaceId)),
    });
  }

  async findByUserId(userId: string): Promise<Workspace[] | null> {
    return await this.db.query.workspace.findMany({
      where: eq(workspace.userId, userId),
    });
  }

  async create(data: NewWorkspace): Promise<Workspace> {
    const result = await this.db.insert(workspace).values(data).returning();

    return result[0];
  }

  async update(id: string, data: Partial<Workspace>): Promise<Workspace | null> {
    const result = await this.db
      .update(workspace)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspace.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(workspace).where(eq(workspace.id, id)).returning({ id: workspace.id });
  }

  async getCountByUserId(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(workspace)
      .where(eq(workspace.userId, userId));

    return result[0]?.count || 0;
  }
}
