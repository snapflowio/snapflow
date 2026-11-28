<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { PayoutReadiness } from '@snapflow/api-client';
import {
	PageBannerKind,
	usePageBanner,
} from '#lib/components/page-banner/page-banner-state.svelte.ts';
import { SUPPORT_HREF } from '#lib/config/support.ts';
import { HostPayoutReadiness } from '#lib/features/machines/state/host-payout-readiness.svelte.ts';

const payout = new HostPayoutReadiness();

usePageBanner(() =>
	payout.readiness === PayoutReadiness.Blocked
		? {
				kind: PageBannerKind.PayoutsBlocked,
				variant: 'destructive',
				message: 'Payouts blocked',
				description:
					'Your payout wallet failed sanctions screening, so public listings are paused.',
				action: { label: 'Contact support', href: SUPPORT_HREF },
			}
		: null
);
</script>
