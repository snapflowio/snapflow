import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrganizationModule } from "../organization/organization.module";
import { Registry } from "./entities/registry.entity";
import { RegistryProvider } from "./providers/registry.provider";
import { REGISTRY_PROVIDER } from "./providers/registry.provider.interface";
import { DockerRegistryController } from "./registry.controller";
import { RegistryService } from "./registry.service";

@Module({
  imports: [OrganizationModule, TypeOrmModule.forFeature([Registry]), HttpModule],
  controllers: [DockerRegistryController],
  providers: [
    {
      provide: REGISTRY_PROVIDER,
      useClass: RegistryProvider,
    },
    RegistryService,
  ],
  exports: [RegistryService],
})
export class DockerRegistryModule {}
