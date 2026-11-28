<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import { adminMfaStepUp } from '#lib/api/admin/mfa-step-up.svelte.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
</script>

<PageColumn title="Admin">
	<EmptyState
		icon={ShieldCheck}
		title="Verify it’s you"
		description="Administrator pages need a session verified with an authenticator app or a passkey."
	>
		{#snippet actions()}
			<Chip
				variant="secondary"
				disabled={adminMfaStepUp.open}
				onclick={() => void adminMfaStepUp.request()}
			>
				Verify
			</Chip>
		{/snippet}
	</EmptyState>
</PageColumn>
