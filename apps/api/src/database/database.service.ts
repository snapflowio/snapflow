import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { TypedConfigService } from "../config/typed-config.service";
import * as schema from "./schema";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;
  public db: NodePgDatabase<typeof schema>;

  constructor(private configService: TypedConfigService) {
    this.pool = new Pool({
      host: this.configService.getOrThrow("database.host"),
      port: this.configService.getOrThrow("database.port"),
      user: this.configService.getOrThrow("database.username"),
      password: this.configService.getOrThrow("database.password"),
      database: this.configService.getOrThrow("database.database"),
      max: 20,
      ssl: false,
    });

    this.db = drizzle<typeof schema>(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
