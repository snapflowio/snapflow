<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { watch } from 'runed';
import { adminMfaStepUp } from '#lib/api/admin/mfa-step-up.svelte.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import type { LayoutProps } from './$types';

let { children }: LayoutProps = $props();

const auth = getAuth();
const verified = $derived(
	Boolean(auth.session?.session.secondFactorVerifiedAt)
);

watch(
	() => verified,
	(isVerified) => {
		if (!isVerified) void adminMfaStepUp.request();
	}
);
</script>

{@render children()}
