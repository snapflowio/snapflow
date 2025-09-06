import { and, count, eq, gt } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import { Repository } from "../../database/decorators/repository.decorator";
import { BaseRepository } from "../../database/repositories/base.repository";
import { NewWorkspaceInvitation, WorkspaceInvitation, WorkspaceInvitationWithWorkspace, workspaceInvitation } from "../../database/schema";
import { WorkspaceInvitationStatus } from "../enums/workspace-invitation-status.enum";

@Repository("WorkspaceInvitation")
export class WorkspaceInvitationRepository extends BaseRepository {
  constructor(databaseService: DatabaseService) {
    super(databaseService.db);
  }

  async create(data: NewWorkspaceInvitation): Promise<WorkspaceInvitation> {
    const result = await this.db.insert(workspaceInvitation).values(data).returning();
    return result[0];
  }

  async findById(id: string): Promise<WorkspaceInvitationWithWorkspace | null> {
    return this.db.query.workspaceInvitation.findFirst({
      where: eq(workspaceInvitation.id, id),
      with: {
        workspace: true,
      },
    }) as Promise<WorkspaceInvitationWithWorkspace | null>;
  }

  async findPendingByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitationWithWorkspace[]> {
    return this.db.query.workspaceInvitation.findMany({
      where: and(
        eq(workspaceInvitation.workspaceId, workspaceId),
        eq(workspaceInvitation.status, WorkspaceInvitationStatus.PENDING),
        gt(workspaceInvitation.expiresAt, new Date())
      ),
      with: {
        workspace: true,
      },
    }) as Promise<WorkspaceInvitationWithWorkspace[]>;
  }

  async findPendingByEmail(email: string): Promise<WorkspaceInvitationWithWorkspace[]> {
    return this.db.query.workspaceInvitation.findMany({
      where: and(
        eq(workspaceInvitation.email, email),
        eq(workspaceInvitation.status, WorkspaceInvitationStatus.PENDING),
        gt(workspaceInvitation.expiresAt, new Date())
      ),
      with: {
        workspace: true,
      },
    }) as Promise<WorkspaceInvitationWithWorkspace[]>;
  }

  async countPendingByEmail(email: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(workspaceInvitation)
      .where(
        and(
          eq(workspaceInvitation.email, email),
          eq(workspaceInvitation.status, WorkspaceInvitationStatus.PENDING),
          gt(workspaceInvitation.expiresAt, new Date())
        )
      );

    return result[0]?.count || 0;
  }

  async findExistingPendingInvitation(
    workspaceId: string,
    email: string
  ): Promise<WorkspaceInvitation | null> {
    return this.db.query.workspaceInvitation.findFirst({
      where: and(
        eq(workspaceInvitation.workspaceId, workspaceId),
        eq(workspaceInvitation.email, email),
        eq(workspaceInvitation.status, WorkspaceInvitationStatus.PENDING),
        gt(workspaceInvitation.expiresAt, new Date())
      ),
    });
  }

  async update(id: string, data: Partial<NewWorkspaceInvitation>): Promise<WorkspaceInvitation> {
    const result = await this.db
      .update(workspaceInvitation)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaceInvitation.id, id))
      .returning();

    return result[0];
  }

  async updateStatus(id: string, status: WorkspaceInvitationStatus): Promise<WorkspaceInvitation> {
    const result = await this.db
      .update(workspaceInvitation)
      .set({ status, updatedAt: new Date() })
      .where(eq(workspaceInvitation.id, id))
      .returning();

    return result[0];
  }
}
