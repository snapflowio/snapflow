/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';

const CLIPBOARD_DENIED_HINT =
	'Allow clipboard access for this site, then try again.';

export async function copyWithToast(
	text: string,
	label: string
): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`Copied ${label}`);
		return true;
	} catch {
		toast.error(`Could not copy ${label}`, {
			description: CLIPBOARD_DENIED_HINT,
		});
		return false;
	}
}
