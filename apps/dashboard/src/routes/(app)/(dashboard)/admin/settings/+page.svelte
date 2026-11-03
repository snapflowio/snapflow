<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { createQuery } from '@tanstack/svelte-query';
import { adminSettingsQueryOptions } from '#lib/api/admin/platform-settings.ts';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import AdminQueryFeedback from '#lib/features/admin/components/admin-query-feedback.svelte';
import AdminSettingsForm from '#lib/features/admin/components/settings/admin-settings-form.svelte';

const settingsQuery = createQuery(() => adminSettingsQueryOptions());
</script>

<svelte:head>
	<title>Settings · Snapflow</title>
</svelte:head>

{#if settingsQuery.data}
	<AdminSettingsForm settings={settingsQuery.data} />
{:else}
	<SettingsPage title="Settings">
		<AdminQueryFeedback
			errorMessage="Failed to load settings"
			loadingMessage="Loading settings..."
			query={settingsQuery}
		/>
	</SettingsPage>
{/if}
