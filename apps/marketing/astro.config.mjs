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
		},
	},
	integrations: [react(), sitemap()],
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
