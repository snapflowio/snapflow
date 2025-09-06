const { composePlugins, withNx } = require("@nx/webpack");
const path = require("path");

module.exports = composePlugins(withNx(), (config) => {
  config.output.devtoolModuleFilenameTemplate = (info) => {
    const rel = path.relative(process.cwd(), info.absoluteResourcePath);
    return `webpack:///./${rel}`;
  };

  config.mode = process.env.NODE_ENV;

  return config;
});
