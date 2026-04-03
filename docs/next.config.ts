import { createMDX } from 'fumadocs-mdx/next';

const withMdx = createMDX();

const config = {
	reactStrictMode: true,
	experimental: {
		webpackMemoryOptimizations: true,
		webpackBuildWorker: true,
	},
	async redirects() {
		return [
			{
				source: '/',
				destination: '/introduction',
				permanent: true,
			},
		];
	},
	async rewrites() {
		return [
			{
				source: '/:path*.mdx',
				destination: '/llms.mdx/:path*',
			},
		];
	},
};

export default withMdx(config);
