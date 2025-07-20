const { composePlugins, withNx } = require("@nx/webpack");
const path = require("path");
const glob = require("glob");

const migrationFiles = glob.sync("apps/api/src/migrations/*");
const migrationEntries = migrationFiles.reduce((acc, migrationFile) => {
  const entryName = migrationFile.substring(
    migrationFile.lastIndexOf("/") + 1,
    migrationFile.lastIndexOf(".")
  );

  acc[entryName] = migrationFile;
  return acc;
}, {});

module.exports = composePlugins(withNx(), (config) => {
  config.output.devtoolModuleFilenameTemplate = (info) => {
    const rel = path.relative(process.cwd(), info.absoluteResourcePath);
    return `webpack:///./${rel}`;
  };

  for (const key in migrationEntries) {
    config.entry[`migrations/${key}`] = migrationEntries[key];
  }

  config.mode = process.env.NODE_ENV;

  return config;
});
