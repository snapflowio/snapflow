<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { useQueryClient } from '@tanstack/svelte-query';
import { adminMfaStepUp } from '#lib/api/admin/mfa-step-up.svelte.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';

const queryClient = useQueryClient();

async function verify() {
	if (await adminMfaStepUp.request()) await queryClient.invalidateQueries();
}
</script>

<Chip onclick={() => void verify()}>Verify identity</Chip>
