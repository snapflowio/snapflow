import { Module } from "@nestjs/common";
import { RepositoryModule } from "../database/decorators";
import { UserModule } from "../user/user.module";
import { WorkspaceController } from "./controllers/workspace.controller";
import { WorkspaceInvitationController } from "./controllers/workspace-invitation.controller";
import { WorkspaceUserController } from "./controllers/workspace-user.controller";
import { WorkspaceInvitationRepository } from "./repositories/workspace-invitation.repository";
import { WorkspaceUserRepository } from "./repositories/workspace-user.repository";
import { WorkspaceRepository } from "./repositories/workspace.repository";
import { WorkspaceInvitationService } from "./services/workspace-invitation.service";
import { WorkspaceUserService } from "./services/workspace-user.service";
import { WorkspaceService } from "./services/workspace.service";

@Module({
  imports: [
    UserModule,
    RepositoryModule.forFeature([WorkspaceRepository, WorkspaceUserRepository, WorkspaceInvitationRepository]),
  ],
  controllers: [WorkspaceController, WorkspaceUserController, WorkspaceInvitationController],
  providers: [WorkspaceService, WorkspaceUserService, WorkspaceInvitationService],
  exports: [WorkspaceService, WorkspaceUserService, WorkspaceInvitationService],
})
export class WorkspaceModule {}
