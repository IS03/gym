const { assertPublicEnv } = require('./src/config/public-env-policy');

// app.json stays the source of truth. Evaluated by `expo config`, `expo start`,
// `expo export`, `expo run:*` and EAS: an unsafe public env fails before any build.
module.exports = ({ config }) => {
  assertPublicEnv(process.env);
  return config;
};
