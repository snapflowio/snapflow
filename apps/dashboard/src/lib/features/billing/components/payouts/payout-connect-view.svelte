<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { CollectionOptions } from '@stripe/connect-js';

const ONBOARDING_COLLECTION: CollectionOptions = {
	fields: 'currently_due',
	futureRequirements: 'omit',
};
</script>

<script lang="ts">
import type {
	ConnectElementTagName,
	ConnectHTMLElementRecord,
} from '@stripe/connect-js';
import type { Attachment } from 'svelte/attachments';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import { createPayoutConnectInstance } from '#lib/integrations/stripe/stripe.ts';

interface PayoutConnectViewProps {
	verified: boolean;
	onAccountChanged: () => void;
}

let { verified, onAccountChanged }: PayoutConnectViewProps = $props();

const connectInstance = createPayoutConnectInstance();

function connectComponent<T extends ConnectElementTagName>(
	tagName: T,
	configure?: (element: ConnectHTMLElementRecord[T]) => void
): Attachment<HTMLDivElement> {
	return (node) => {
		const element = connectInstance.create(tagName);
		configure?.(element);
		node.append(element);
		return () => element.remove();
	};
}
</script>

<SettingsSection
	title={verified ? 'Account details' : 'Verification'}
	description="Stripe keeps your identity and bank details. Snapflow never sees or stores them."
>
	<div class="flex flex-col gap-4">
		<div {@attach connectComponent('notification-banner')}></div>
		{#if verified}
			<div {@attach connectComponent('account-management')}></div>
		{:else}
			<div
				{@attach connectComponent('account-onboarding', (element) => {
					element.setCollectionOptions(ONBOARDING_COLLECTION);
					element.setOnExit(() => onAccountChanged());
				})}
			></div>
		{/if}
	</div>
</SettingsSection>
