/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import path from 'node:path';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 3000,
		host: '0.0.0.0',
		strictPort: true,
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: false,
				ws: true,
			},
		},
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				pages: '../../dist/apps/dashboard',
				assets: '../../dist/apps/dashboard',
				fallback: '200.html',
			}),
			compilerOptions: { runes: true },
			paths: { base: '/dashboard' },
			version: { name: process.env['SNAPFLOW_RELEASE_VERSION'] },
		}),
	],
	resolve: {
		tsconfigPaths: true,
		alias: [
			{
				find: /^zod$/,
				replacement: path.resolve(
					import.meta.dirname,
					'./src/lib/config/zod-config.ts'
				),
			},
		],
	},
});
