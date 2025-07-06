import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { OrganizationAuthContext } from "../../common/interfaces/auth-context.interface";
import { SystemRole } from "../../user/enums/system-role.enum";
import { Snapshot } from "../entities/snapshot.entity";
import { SnapshotService } from "../services/snapshot.service";

@Injectable()
export class SnapshotAccessGuard implements CanActivate {
  constructor(private readonly snapshotService: SnapshotService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const snapshotId: string = request.params.snapshotId || request.params.id;
    const authContext: OrganizationAuthContext = request.user;

    let snapshot: Snapshot;

    try {
      snapshot = await this.snapshotService.getSnapshot(snapshotId);
    } catch (error) {
      snapshot = await this.snapshotService.getSnapshotByName(
        snapshotId,
        authContext.organizationId
      );
    }

    if (
      authContext.role !== SystemRole.ADMIN &&
      snapshot.organizationId !== authContext.organizationId
    ) {
      throw new ForbiddenException(
        "Request organization ID does not match resource organization ID"
      );
    }

    request.snapshot = snapshot;
    return true;
  }
}
