import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Team } from "./team.entity";
import { TeamService } from "./team.service";

@Module({
  imports: [TypeOrmModule.forFeature([Team])],
  providers: [TeamService],
})
export class TeamModule {}
