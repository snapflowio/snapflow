import { join } from "path";
import { DataSource } from "typeorm";
import { CustomNamingStrategy } from "./common/utils/naming-strategy.util";

const AppDataSource = new DataSource({
  type: "postgres" as const,
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT!, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  migrations: [join(__dirname, "migrations/**/*{.ts,.js}")],
  migrationsRun: false,
  logging: process.env.DB_LOGGING === "true",
  namingStrategy: new CustomNamingStrategy(),
  entities: [join(__dirname, "**/*.entity.ts")],
});

export default AppDataSource;
