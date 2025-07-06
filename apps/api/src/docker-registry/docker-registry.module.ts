import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganizationModule } from "../organization/organization.module";
import { DockerRegistryController } from "./docker-registry.controller";
import { DockerRegistryService } from "./docker-registry.service";
import { DockerRegistry } from "./entities/docker-registry.entity";
import { DockerRegistryProvider } from "./providers/docker-registry.provider";
import { DOCKER_REGISTRY_PROVIDER } from "./providers/docker-registry.provider.interface";

@Module({
  imports: [OrganizationModule, TypeOrmModule.forFeature([DockerRegistry]), HttpModule],
  controllers: [DockerRegistryController],
  providers: [
    {
      provide: DOCKER_REGISTRY_PROVIDER,
      useClass: DockerRegistryProvider,
    },
    DockerRegistryService,
  ],
  exports: [DockerRegistryService],
})
export class DockerRegistryModule {}
