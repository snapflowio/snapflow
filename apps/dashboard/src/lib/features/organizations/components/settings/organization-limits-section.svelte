<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { OrganizationLimits } from '@snapflow/api-client';

const PLATFORM_DEFAULT_LABEL = 'Platform default';
</script>

<script lang="ts">
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';

interface OrganizationLimitsSectionProps {
	limits: OrganizationLimits;
}

let { limits }: OrganizationLimitsSectionProps = $props();
</script>

<SettingsSection title="Organization">
	<SettingsRow label="Storage cap">
		<span class="text-(--text-primary) text-sm tabular-nums">
			{limits.storageCapGib === null
				? PLATFORM_DEFAULT_LABEL
				: `${limits.storageCapGib} GiB`}
		</span>
	</SettingsRow>
	<SettingsRow
		label="Limited egress"
		description="Set by Snapflow. When enforced, every sandbox starts with limited outbound network access."
	>
		<Badge
			size="sm"
			variant={limits.sandboxLimitedNetworkEgress ? 'warning' : 'neutral'}
		>
			{limits.sandboxLimitedNetworkEgress ? 'Enforced' : 'Off'}
		</Badge>
	</SettingsRow>
</SettingsSection>
