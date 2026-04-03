/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

/// <reference types="vite/client" />

declare module '*.png' {
	const content: string;
	export default content;
}

declare module '*.svg' {
	const content: string;
	export default content;
}

declare module '*.jpg' {
	const content: string;
	export default content;
}

declare module '*.jpeg' {
	const content: string;
	export default content;
}

interface ImportMetaEnv {
	readonly VITE_WEBSITE_URL: string;
	readonly VITE_API_URL: string;
	readonly VITE_PROXY_TEMPLATE_URL: string;
	readonly VITE_POSTHOG_KEY: string;
	readonly VITE_POSTHOG_HOST: string;
	readonly VITE_SHOW_ENTERPRISE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
