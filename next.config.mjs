/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // В App Router нет api.bodyParser — это для Pages Router
  // Для больших запросов используйте streaming или настройте serverActions.bodySizeLimit выше
};
export default nextConfig;
