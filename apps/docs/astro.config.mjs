/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightTypeDoc from 'starlight-typedoc';
import { SDK_REFERENCE } from './src/config/sdk-reference.ts';
import { SIDEBAR } from './src/config/sidebar.ts';
import { DOCS_BASE, SITE } from './src/config/site.ts';
import { SNAPFLOW_CODE_THEME } from './src/lib/code-theme.ts';

function isValidatedDocsLink(link) {
	return !link.startsWith('/') || link.startsWith(DOCS_BASE);
}

export default defineConfig({
	site: process.env.PUBLIC_SITE_URL,
	base: DOCS_BASE,
	outDir: '../../dist/apps/docs',
	output: 'static',
	trailingSlash: 'ignore',
	compressHTML: true,
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
	integrations: [
		starlight({
			title: SITE.TITLE,
			description: SITE.DESCRIPTION,
			favicon: '/favicon.svg',
			social: [
				{ icon: 'github', label: 'GitHub', href: SITE.REPOSITORY_URL },
				{ icon: 'discord', label: 'Discord', href: SITE.DISCORD_URL },
			],
			editLink: { baseUrl: SITE.EDIT_URL },
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			sidebar: SIDEBAR,
			routeMiddleware: './src/route-middleware.ts',
			customCss: ['./src/styles/theme.css'],
			expressiveCode: {
				themes: [SNAPFLOW_CODE_THEME],
				useStarlightDarkModeSwitch: false,
				useStarlightUiThemeColors: false,
				styleOverrides: {
					borderRadius: 'var(--frame-radius)',
					borderColor: 'var(--border)',
					codeFontFamily: 'var(--sl-font-mono)',
					codeFontSize: 'var(--sl-text-code)',
					codeBackground: 'var(--surface-1)',
					uiFontFamily: 'var(--sl-font)',
					frames: {
						editorBackground: 'var(--surface-1)',
						terminalBackground: 'var(--surface-1)',
						editorTabBarBackground: 'var(--bg)',
						editorActiveTabBackground: 'var(--surface-1)',
						editorActiveTabIndicatorTopColor: 'transparent',
						editorActiveTabIndicatorBottomColor: 'transparent',
						terminalTitlebarBackground: 'var(--bg)',
						terminalTitlebarBorderBottomColor: 'var(--border)',
						frameBoxShadowCssValue: 'none',
						inlineButtonBorder: 'var(--border)',
						tooltipSuccessBackground: 'var(--brand-accent)',
					},
				},
			},
			components: {
				Head: './src/components/starlight/head.astro',
				Header: './src/components/starlight/header.astro',
				SiteTitle: './src/components/starlight/site-title.astro',
				ThemeProvider: './src/components/starlight/theme-provider.astro',
				ThemeSelect: './src/components/starlight/theme-select.astro',
				PageTitle: './src/components/starlight/page-title.astro',
				Footer: './src/components/starlight/footer.astro',
				MobileMenuFooter: './src/components/starlight/mobile-menu-footer.astro',
			},
			plugins: [
				starlightTypeDoc({
					entryPoints: [SDK_REFERENCE.entryPoint],
					tsconfig: SDK_REFERENCE.tsconfig,
					output: SDK_REFERENCE.output,
					pagination: true,
					sidebar: { label: SDK_REFERENCE.label, collapsed: false },
					typeDoc: {
						excludePrivate: true,
						excludeProtected: true,
						excludeInternal: true,
						excludeExternals: true,
						entryFileName: 'index',
					},
				}),
				starlightLlmsTxt({
					projectName: SITE.NAME,
					description: SITE.DESCRIPTION,
				}),
				starlightLinksValidator({
					exclude: ({ link }) => !isValidatedDocsLink(link),
				}),
			],
		}),
	],
	server: {
		host: true,
		port: 4322,
	},
	vite: {
		plugins: [tailwindcss()],
		server: {
			strictPort: true,
		},
		build: {
			sourcemap: false,
			minify: 'oxc',
			cssMinify: 'lightningcss',
		},
	},
});
