/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/direktori-opd",
        destination: "/data-opd",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
