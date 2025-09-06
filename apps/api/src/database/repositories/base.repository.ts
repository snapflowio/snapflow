import { Logger } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";

export type Database = NodePgDatabase<typeof schema>;

/**
 * Base repository class that provides common database access patterns
 * Similar to TypeORM's Repository base class
 */
export abstract class BaseRepository {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly db: Database) {}

  /**
   * Execute queries within a transaction
   * @param callback - Function to execute within transaction
   */
  async transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(callback);
  }

  /**
   * Get the underlying database connection
   */
  get connection(): Database {
    return this.db;
  }

  /**
   * Log query execution (can be overridden)
   */
  protected logQuery(query: string, params?: any[]): void {
    if (process.env.NODE_ENV !== "production") {
      this.logger.debug(`Query: ${query}`, params ? `Params: ${JSON.stringify(params)}` : "");
    }
  }
}
