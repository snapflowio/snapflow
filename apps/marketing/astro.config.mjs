/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { Path } from './src/constants/paths.ts';
import { BLOG_POSTS } from './src/data/blog-posts.ts';

function includeInSitemap(page) {
	return BLOG_POSTS.length > 0 || !new URL(page).pathname.startsWith(Path.BLOG);
}

export default defineConfig({
	site: process.env.PUBLIC_SITE_URL,
	outDir: '../../dist/apps/marketing',
	output: 'static',
	trailingSlash: 'ignore',
	compressHTML: true,
	redirects: {
		'/how-to-earn': '/#hosts',
	},
	devToolbar: { enabled: false },
	env: {
		schema: {
			PUBLIC_SITE_URL: envField.string({
				context: 'client',
				access: 'public',
				url: true,
			}),
			PUBLIC_POSTHOG_PROJECT_KEY: envField.string({
				context: 'client',
				access: 'public',
				optional: true,
			}),
			PUBLIC_POSTHOG_HOST: envField.string({
				context: 'client',
				access: 'public',
				url: true,
				optional: true,
			}),
		},
	},
	integrations: [react(), sitemap({ filter: includeInSitemap })],
	server: {
		host: true,
		port: 4321,
	},
	vite: {
		plugins: [tailwindcss()],
		server: {
			strictPort: true,
			proxy: {
				'/api': {
					target: 'http://127.0.0.1:3001',
					changeOrigin: false,
					ws: true,
				},
				'/dashboard': {
					target: 'http://127.0.0.1:3000',
					changeOrigin: false,
				},
				'/docs': {
					target: 'http://127.0.0.1:4322',
					changeOrigin: false,
					ws: true,
				},
			},
		},
		build: {
			sourcemap: false,
			minify: 'oxc',
			cssMinify: 'lightningcss',
		},
		environments: {
			client: {
				build: {
					rolldownOptions: {
						output: {
							entryFileNames: '_astro/[hash].js',
							chunkFileNames: '_astro/[hash].js',
							assetFileNames: '_astro/[hash][extname]',
						},
					},
				},
			},
			prerender: {
				build: {
					rolldownOptions: {
						output: {
							assetFileNames: '_astro/[hash][extname]',
						},
					},
				},
			},
		},
		ssr: {
			noExternal: ['cookie'],
		},
	},
});
