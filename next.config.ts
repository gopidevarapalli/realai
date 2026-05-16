/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: {
      // Instructs Turbopack to completely ignore compiling native node bindings
      aliases: {
        'onnxruntime-node': false,
      },
    },
  },
  // Keeps normal Webpack backwards-compat enabled if needed
  webpack: (config: any, { isServer }: any) => {
    if (isServer) {
      config.externals.push({
        'onnxruntime-node': 'commonjs onnxruntime-node',
      });
    }
    return config;
  },
};

export default nextConfig;