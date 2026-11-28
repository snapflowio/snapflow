<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import LegalLink from './legal-link.svelte';

interface LegalConsentLineProps {
	action: string;
}

let { action }: LegalConsentLineProps = $props();

const { privacyHref, termsHref } = getWebsiteLinks();
</script>

<p
	class="text-pretty text-center text-(--text-secondary) text-sm leading-relaxed"
>
	By {action}, you agree to the
	<LegalLink href={termsHref}>Terms of Service</LegalLink>
	and acknowledge the
	<LegalLink href={privacyHref}>Privacy Policy</LegalLink>.
</p>
