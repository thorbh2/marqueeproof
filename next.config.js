const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  devIndicators: false,
  webpack(config) {
    config.resolve.alias['@react-native-async-storage/async-storage'] = false;
    return config;
  },
};

module.exports = nextConfig;
