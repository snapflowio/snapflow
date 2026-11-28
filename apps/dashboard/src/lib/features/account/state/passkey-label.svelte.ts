/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { getAuthenticatorName } from '@better-auth/passkey';

const FALLBACK_PASSKEY_LABEL = 'Passkey';

interface PasskeyIdentity {
	name?: string | null;
	aaguid?: string | null;
}

let authenticatorName = $state.raw<typeof getAuthenticatorName | null>(null);
let loading = false;

function loadAuthenticatorNames(): void {
	if (loading) return;
	loading = true;
	void import('@better-auth/passkey').then((module) => {
		authenticatorName = module.getAuthenticatorName;
	});
}

export function passkeyLabel({ name, aaguid }: PasskeyIdentity): string {
	if (name) return name;
	if (authenticatorName === null) loadAuthenticatorNames();
	return authenticatorName?.(aaguid) || FALLBACK_PASSKEY_LABEL;
}
