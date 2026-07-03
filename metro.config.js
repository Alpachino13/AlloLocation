const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force Metro à bien résoudre les extensions mjs/cjs utilisées par Supabase v2
config.resolver.sourceExts.push('mjs', 'cjs');

// Empêche Metro de s'embrouiller avec les exports de modules Node
config.resolver.unstable_enablePackageExports = false;

module.exports = config;