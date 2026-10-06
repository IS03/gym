const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { assertPublicEnv } = require('./src/config/public-env-policy');

// Every bundle (dev server, export, native embed) refuses unsafe public env values.
assertPublicEnv(process.env);

const config = getDefaultConfig(__dirname);
// The portable Nutrition wire contract is shared with the Next API. Expose
// this source directory, without adding the root dependency tree to Metro.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../../src/lib/mobile-api')];
module.exports = config;
