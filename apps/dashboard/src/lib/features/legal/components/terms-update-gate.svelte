<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const BRAND_MARK_SIZE = 48;
const TERMS_REFRESH_FAILED_MESSAGE = 'Failed to load the latest Terms';
</script>

<script lang="ts">
import {
	createMutation,
	createQuery,
	type MutationCacheNotifyEvent,
	type QueryCacheNotifyEvent,
	useQueryClient,
} from '@tanstack/svelte-query';
import type { Snippet } from 'svelte';
import {
	acceptTermsMutationOptions,
	authenticatedUserQueryOptions,
	isTermsAcceptanceRequired,
} from '#lib/api/account/terms.ts';
import { SIGN_OUT_FAILED_MESSAGE, signOut } from '#lib/api/auth/session.ts';
import { showApiError } from '#lib/api/errors/show-api-error.ts';
import {
	getPublicConfig,
	getWebsiteLinks,
	publicConfigQueryOptions,
} from '#lib/api/public-config.ts';
import BrandMark from '#lib/components/brand-mark.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import AuthSubmitButton from '#lib/features/auth/components/sign-in/auth-submit-button.svelte';
import { AUTH_BUTTON_CLASS } from '#lib/features/auth/lib/sign-in/auth-form-styles.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import LegalLink from './legal-link.svelte';

interface TermsUpdateGateProps {
	children: Snippet;
}

let { children }: TermsUpdateGateProps = $props();

const queryClient = useQueryClient();
const auth = getAuth();
const { legal } = getPublicConfig();
const { termsHref, privacyHref } = getWebsiteLinks();
const user = createQuery(() => authenticatedUserQueryOptions());
const accept = createMutation(() => acceptTermsMutationOptions());

let rejectedByApi = $state(false);
let signingOut = $state(false);
let refreshingTerms = $state(false);
let termsVersion = $state(legal.termsVersion);

const impersonating = $derived(Boolean(auth.session?.session.impersonatedBy));
const outdated = $derived(
	user.data !== undefined && user.data.acceptedTermsVersion !== termsVersion
);
const required = $derived(!impersonating && (outdated || rejectedByApi));
const busy = $derived(accept.isPending || signingOut || refreshingTerms);

function flagTermsError(
	event: QueryCacheNotifyEvent | MutationCacheNotifyEvent
): void {
	if (
		event.type === 'updated' &&
		event.action.type === 'error' &&
		isTermsAcceptanceRequired(event.action.error)
	) {
		rejectedByApi = true;
	}
}

$effect(() => {
	const unsubscribes = [
		queryClient.getQueryCache().subscribe(flagTermsError),
		queryClient.getMutationCache().subscribe(flagTermsError),
	];
	return () => {
		for (const unsubscribe of unsubscribes) unsubscribe();
	};
});

async function latestTermsVersion(): Promise<string> {
	if (outdated) return termsVersion;
	refreshingTerms = true;
	try {
		const config = await queryClient.query({
			...publicConfigQueryOptions(),
			staleTime: 0,
		});
		termsVersion = config.legal.termsVersion;
		return termsVersion;
	} finally {
		refreshingTerms = false;
	}
}

async function agree(): Promise<void> {
	let version: string;
	try {
		version = await latestTermsVersion();
	} catch (error) {
		showApiError(error, TERMS_REFRESH_FAILED_MESSAGE);
		return;
	}
	accept.mutate(version, {
		onSuccess: () => {
			rejectedByApi = false;
		},
	});
}

function focusHeading(heading: HTMLElement): void {
	heading.focus();
}

async function signOutOfAccount(): Promise<void> {
	signingOut = true;
	try {
		await signOut(queryClient);
	} catch (error) {
		showApiError(error, SIGN_OUT_FAILED_MESSAGE);
	} finally {
		signingOut = false;
	}
}
</script>

{#if required}
	<div
		class="flex min-h-dvh w-full flex-1 flex-col items-center justify-center bg-bg px-4 py-16"
	>
		<section
			aria-labelledby="terms-update-title"
			class="flex w-full max-w-md flex-col justify-between gap-8 rounded-3xl bg-surface-1 p-12"
		>
			<div class="flex flex-col gap-y-4">
				<BrandMark size={BRAND_MARK_SIZE} />
				<div class="flex flex-col gap-4">
					<h1
						id="terms-update-title"
						tabindex="-1"
						class="font-heading text-(--text-primary) text-2xl outline-none"
						{@attach focusHeading}
					>
						We've updated our Terms
					</h1>
					<p class="text-balance text-(--text-muted) text-lg">
						Please review the
						<LegalLink href={termsHref}>Terms of Service</LegalLink>
						and the
						<LegalLink href={privacyHref}>Privacy Policy</LegalLink>
						before you continue using Snapflow.
					</p>
				</div>
			</div>
			<div class="flex w-full flex-col gap-y-4">
				<AuthSubmitButton
					type="button"
					loading={accept.isPending}
					disabled={busy}
					onclick={() => void agree()}
				>
					I agree
				</AuthSubmitButton>
				<Chip
					fullWidth
					variant="secondary"
					class={AUTH_BUTTON_CLASS}
					loading={signingOut}
					disabled={busy}
					onclick={() => void signOutOfAccount()}
				>
					Sign out
				</Chip>
			</div>
		</section>
	</div>
{:else if user.data}
	{@render children()}
{/if}
