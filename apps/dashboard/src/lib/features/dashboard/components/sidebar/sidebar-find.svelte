<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FIND_SHORTCUT = ['mod', 'K'] as const;
const FIND_KEYSHORTCUTS = 'Meta+K Control+K';
</script>

<script lang="ts">
import Search from '@lucide/svelte/icons/search';
import IconButton from '#lib/components/ui/icon-button.svelte';
import { getGlobalCommands } from '#lib/features/dashboard/state/global-commands.svelte.ts';

const commands = getGlobalCommands();
</script>

<IconButton
	variant="quiet"
	size="md"
	label="Search"
	icon={Search}
	shortcut={FIND_SHORTCUT}
	aria-keyshortcuts={FIND_KEYSHORTCUTS}
	onclick={commands.togglePalette}
/>
