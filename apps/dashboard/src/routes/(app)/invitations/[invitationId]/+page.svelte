<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import AuthLayout from '#lib/features/auth/components/layout/auth-layout.svelte';
import OrganizationInvitation from '#lib/features/auth/components/organization-invitation.svelte';
import type { PageProps } from './$types';

let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Organization invitation · Snapflow</title>
</svelte:head>

<AuthLayout>
	{#key params.invitationId}
		<OrganizationInvitation invitationId={params.invitationId} />
	{/key}
</AuthLayout>
