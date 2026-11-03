<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import DeviceApproval from '#lib/features/auth/components/device-approval.svelte';
import DeviceCodeEntry from '#lib/features/auth/components/device-code-entry.svelte';
import AuthLayout from '#lib/features/auth/components/layout/auth-layout.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Connect your terminal · Snapflow</title>
</svelte:head>

<AuthLayout>
	{#if data.userCode}
		{#key data.userCode}
			<DeviceApproval userCode={data.userCode} />
		{/key}
	{:else}
		<DeviceCodeEntry />
	{/if}
</AuthLayout>
