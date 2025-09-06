import { Global, Module } from "@nestjs/common";

import { DatabaseService } from "./database.service";

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: "DATABASE_SERVICE",
      useExisting: DatabaseService,
    },
    {
      provide: "DATABASE_CONNECTION",
      useFactory: (databaseService: DatabaseService) => databaseService.db,
      inject: [DatabaseService],
    },
  ],
  exports: [DatabaseService, "DATABASE_SERVICE", "DATABASE_CONNECTION"],
})
export class DatabaseModule {}
