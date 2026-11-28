<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { online } from 'svelte/reactivity/window';
import { PageBannerKind, usePageBanner } from './page-banner-state.svelte.ts';

usePageBanner(() =>
	online.current === false
		? {
				kind: PageBannerKind.Offline,
				variant: 'default',
				message: "You're offline",
				description: 'Snapflow reconnects when your connection returns.',
			}
		: null
);
</script>
