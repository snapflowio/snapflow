<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ShieldOff from '@lucide/svelte/icons/shield-off';
import type { AbuseCase } from '@snapflow/api-client';
import EmptyState from '#lib/components/empty-state.svelte';
import AbuseCaseDetails from './abuse-case-details.svelte';

interface AbuseReportCaseTabProps {
	abuseCase: AbuseCase | null;
}

let { abuseCase }: AbuseReportCaseTabProps = $props();
</script>

{#if abuseCase}
	<AbuseCaseDetails {abuseCase} layout="page" />
{:else}
	<EmptyState icon={ShieldOff} title="No sandbox matched this report" />
{/if}
