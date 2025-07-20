import { DefaultNamingStrategy, type NamingStrategyInterface, Table } from "typeorm";
import { snakeCase } from "typeorm/util/StringUtils";

/**
 * A custom TypeORM naming strategy to generate more descriptive names for keys,
 * constraints, and indices. Names are generated in the format:
 * `tableName_columnNames_suffix`.
 */
export class CustomNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  /**
   * Generates a custom name for a primary key.
   * @example "user_id_pk"
   */
  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return this.generateName("pk", tableOrName, columnNames);
  }

  /**
   * Generates a custom name for a foreign key.
   * @example "user_profile_userId_fk"
   */
  foreignKeyName(tableOrName: Table | string, columnNames: string[]): string {
    return this.generateName("fk", tableOrName, columnNames);
  }

  /**
   * Generates a custom name for a unique constraint.
   * @example "user_email_unique"
   */
  uniqueConstraintName(tableOrName: Table | string, columnNames: string[]): string {
    return this.generateName("unique", tableOrName, columnNames);
  }

  /**
   * Generates a custom name for an index.
   * @example "user_lastName_index"
   */
  indexName(tableOrName: Table | string, columnNames: string[]): string {
    return this.generateName("index", tableOrName, columnNames);
  }

  /**
   * A protected helper to generate a standardized, snake-cased name for database constraints.
   *
   * @param suffix - The suffix for the constraint type (e.g., 'pk', 'fk', 'unique').
   * @param tableOrName - The table instance or its name.
   * @param columnNames - The array of column names involved in the constraint.
   * @returns A snake-cased constraint name string.
   */
  protected generateName(
    suffix: string,
    tableOrName: Table | string,
    columnNames: string[]
  ): string {
    const table = tableOrName instanceof Table ? tableOrName.name : tableOrName;
    const columns = columnNames.join("_");
    return snakeCase(`${table}_${columns}_${suffix}`);
  }
}
