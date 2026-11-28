/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateSandbox,
	type MachineLocations,
	type OrganizationLimits,
	type OrganizationUsageOverview,
	PlacementKind,
	type SandboxPlacementAlternative,
	SandboxPlacementErrorCode,
	type SandboxQuote,
	type SandboxQuoteRequest,
	type SnapshotDto,
	SnapshotState,
	VolumeState,
} from '@snapflow/api-client';
import { revalidateLogic } from '@tanstack/svelte-form';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import { Debounced } from 'runed';
import { tick } from 'svelte';
import { idempotencyHeaders } from '#lib/api/client/api-client.ts';
import {
	createSandboxMutationOptions,
	sandboxQuoteQueryOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { allSecretsQueryOptions } from '#lib/api/secrets.ts';
import { allVolumesQueryOptions } from '#lib/api/volumes.ts';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { focusFirstInvalidField } from '#lib/components/form/focus-first-invalid-field.ts';
import {
	setServerFieldErrors,
	submitMutation,
} from '#lib/components/form/submit.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { locationOptions } from '#lib/features/locations/lib/location-format.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { CREATE_SANDBOX_STEPS } from '#lib/features/sandboxes/lib/create/create-sandbox-options.ts';
import {
	type CreateSandboxFieldCorrections,
	fieldCorrectionsFor,
	gpuAvailableFor,
	gpuOptionsFor,
	snapshotNamed,
} from '#lib/features/sandboxes/lib/create/create-sandbox-placement.ts';
import {
	toCreateSandbox,
	toSandboxQuoteRequest,
	withAcceptedPrice,
} from '#lib/features/sandboxes/lib/create/create-sandbox-request.ts';
import {
	type CreateSandboxValues,
	createDefaultValues,
	createSandboxSchema,
} from '#lib/features/sandboxes/lib/create/create-sandbox-schema.ts';
import {
	createSandboxFieldErrors,
	firstStepWithErrors,
} from '#lib/features/sandboxes/lib/create/create-sandbox-server-errors.ts';
import {
	type PlacementError,
	placementError,
} from '#lib/features/sandboxes/lib/placement-errors.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export interface CreateSandboxWizardOptions {
	close: () => void;
	limits: OrganizationLimits;
	locations: MachineLocations | undefined;
	open: boolean;
	pinnedMachineId: string | null;
	presetSnapshot: string | null;
	snapshots: readonly SnapshotDto[];
	usage: OrganizationUsageOverview | undefined;
}

export interface CreateSandboxDraft {
	step: number;
	values: CreateSandboxValues;
}

type WizardSubmitTarget = 'create' | 'next' | 'review';

interface WizardSubmitMeta {
	target: WizardSubmitTarget;
}

interface SandboxFormConfig {
	advance: (target: Exclude<WizardSubmitTarget, 'create'>) => void;
	correct: () => void;
	create: (values: CreateSandboxValues) => Promise<void>;
	defaultValues: () => CreateSandboxValues;
	focusInvalid: () => void;
	limits: () => OrganizationLimits;
}

interface PlacementFailure {
	error: PlacementError;
	quote: SandboxQuote | undefined;
}

const FIRST_STEP = 0;
const LAST_STEP_INDEX = CREATE_SANDBOX_STEPS.length - 1;
const REVIEW_STEP_KEY = 'review';
const QUOTE_DEBOUNCE_MILLISECONDS = 350;
const DEFAULT_SUBMIT_META: WizardSubmitMeta = { target: 'create' };
const CREATE_SANDBOX_FAILURE = 'Failed to create sandbox';
const MAX_CORRECTION_PASSES = 3;

function hasCorrections(corrections: CreateSandboxFieldCorrections): boolean {
	return Object.keys(corrections).length > 0;
}

function createSandboxForm(config: SandboxFormConfig) {
	return createAppForm(() => ({
		defaultValues: config.defaultValues(),
		onSubmitMeta: DEFAULT_SUBMIT_META,
		validationLogic: revalidateLogic(),
		validators: { onDynamic: createSandboxSchema(config.limits()) },
		onSubmit: async ({ meta, value }) => {
			if (meta.target === 'create') await config.create(value);
			else config.advance(meta.target);
		},
		onSubmitInvalid: config.focusInvalid,
		listeners: { onChange: config.correct },
	}));
}

export type CreateSandboxForm = ReturnType<typeof createSandboxForm>;

export class CreateSandboxWizard {
	step = $state(FIRST_STEP);
	readonly lastStepIndex = LAST_STEP_INDEX;
	readonly form: CreateSandboxForm;
	readonly #options: () => CreateSandboxWizardOptions;
	readonly #values: { readonly current: CreateSandboxValues };
	readonly #isDirty: { readonly current: boolean };
	readonly #permission = getOrganizationPermission();
	readonly #createMutation = createMutation(() => {
		const options = createSandboxMutationOptions();
		return {
			...options,
			meta: {
				...options.meta,
				failure: (error: unknown) =>
					firstStepWithErrors(createSandboxFieldErrors(error)) < FIRST_STEP
						? CREATE_SANDBOX_FAILURE
						: undefined,
			},
		};
	});
	#formElement: HTMLFormElement | null = null;
	#placementFailure: PlacementFailure | null = $state.raw(null);

	readonly #secretsQuery;
	readonly #volumesQuery;
	readonly #quoteRequest: Debounced<SandboxQuoteRequest | null>;
	readonly #quote;
	readonly availableSnapshots = $derived.by(() =>
		this.#options().snapshots.filter(
			(snapshot) => snapshot.state === SnapshotState.Active
		)
	);
	readonly #defaultValues = $derived.by(() =>
		createDefaultValues(
			this.#options().pinnedMachineId,
			this.#options().presetSnapshot
		)
	);
	readonly currentStep = $derived(
		CREATE_SANDBOX_STEPS[this.step] ?? CREATE_SANDBOX_STEPS[FIRST_STEP]
	);
	readonly selectedSnapshot = $derived(
		snapshotNamed(this.availableSnapshots, this.values.snapshot)
	);
	readonly locationOptions = $derived.by(() =>
		locationOptions(this.#options().locations?.continents ?? [])
	);
	readonly callerLocation = $derived.by(
		() => this.#options().locations?.caller ?? null
	);
	readonly gpuOptions = $derived.by(() => gpuOptionsFor(this.#options().usage));
	readonly gpuAvailable = $derived.by(() =>
		gpuAvailableFor(this.#options().usage)
	);
	readonly availableVolumes = $derived.by(() =>
		(this.#volumesQuery.data ?? []).filter(
			(volume) => volume.state === VolumeState.Ready
		)
	);
	readonly formIsValid = $derived.by(
		() =>
			createSandboxSchema(this.#options().limits).safeParse(this.values).success
	);
	readonly quoteRequest = $derived.by(() => {
		try {
			return toSandboxQuoteRequest(
				toCreateSandbox(this.values, undefined, this.#volumesQuery.data ?? [])
			);
		} catch {
			return toSandboxQuoteRequest(toCreateSandbox(this.values));
		}
	});
	#acceptedPriceCardId = $derived.by(() => this.#quote.data?.priceCardId);
	readonly placementFailure: PlacementError | null = $derived.by(() => {
		const failure = this.#placementFailure;
		if (!failure) return null;
		const superseded =
			failure.error.kind === SandboxPlacementErrorCode.PriceChanged &&
			this.#quote.data !== failure.quote;
		return superseded ? null : failure.error;
	});
	readonly shownQuote = $derived.by(() =>
		this.placementFailure?.kind === SandboxPlacementErrorCode.PriceChanged
			? { data: this.placementFailure.quote, isError: false, isPending: false }
			: this.#quote
	);

	constructor(options: () => CreateSandboxWizardOptions) {
		this.#options = options;
		this.form = createSandboxForm({
			advance: this.#goToNextStep,
			correct: this.#correct,
			create: this.#create,
			defaultValues: () => this.#defaultValues,
			focusInvalid: () => focusFirstInvalidField(this.#formElement),
			limits: () => this.#options().limits,
		});
		this.#values = this.form.useSelector((state) => state.values);
		this.#isDirty = this.form.useSelector((state) => state.isDirty);
		this.#secretsQuery = createQuery(() => ({
			...allSecretsQueryOptions(),
			enabled: options().open && this.#permission.can({ secrets: ['read'] }),
			retry: false,
		}));
		this.#volumesQuery = createQuery(() => ({
			...allVolumesQueryOptions(),
			enabled: options().open && this.#permission.can({ volumes: ['read'] }),
			retry: false,
		}));
		this.#quoteRequest = new Debounced(
			() =>
				options().open &&
				this.formIsValid &&
				this.currentStep.key === REVIEW_STEP_KEY
					? this.quoteRequest
					: null,
			QUOTE_DEBOUNCE_MILLISECONDS
		);
		this.#quote = createQuery(() =>
			sandboxQuoteQueryOptions(
				this.#quoteRequest.pending ? null : this.#quoteRequest.current
			)
		);
	}

	get values(): CreateSandboxValues {
		return this.#values.current;
	}

	get secrets() {
		return this.#secretsQuery.data;
	}

	get isFirstStep(): boolean {
		return this.step === FIRST_STEP;
	}

	get isLastStep(): boolean {
		return this.step >= LAST_STEP_INDEX;
	}

	get hasDraft(): boolean {
		return this.#isDirty.current || this.step > FIRST_STEP;
	}

	get stepLabel(): string {
		return `Step ${this.step + 1} of ${CREATE_SANDBOX_STEPS.length}`;
	}

	get stepShortLabel(): string {
		return `${this.step + 1}/${CREATE_SANDBOX_STEPS.length}`;
	}

	goBack = (): void => {
		this.step = Math.max(FIRST_STEP, this.step - 1);
	};

	submit = (
		event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }
	): void => {
		this.#formElement = event.currentTarget;
		void this.form.handleSubmit({
			target: this.isLastStep ? 'create' : 'next',
		});
	};

	skipToReview = (formElement: HTMLFormElement | null): void => {
		this.#formElement = formElement;
		void this.form.handleSubmit({ target: 'review' });
	};

	reset = (): void => {
		this.form.reset();
		this.step = FIRST_STEP;
		this.#placementFailure = null;
	};

	useMachine = (alternative: SandboxPlacementAlternative): void => {
		this.#pinMachine(alternative.machineId);
		this.#placementFailure = null;
	};

	rentWholeMachine = (wholeMachine: boolean): void => {
		const machineId = this.shownQuote.data?.machineId;
		if (wholeMachine && machineId) this.#pinMachine(machineId);
		this.form.setFieldValue('wholeMachine', wholeMachine);
	};

	captureDraft = (): CreateSandboxDraft => ({
		step: this.step,
		values: this.form.state.values,
	});

	restoreDraft = (draft: CreateSandboxDraft): void => {
		this.form.reset(draft.values, { keepDefaultValues: true });
		this.step = draft.step;
	};

	#pinMachine(machineId: string): void {
		const values = this.form.state.values;
		if (values.placementKind !== PlacementKind.Pinned) {
			this.form.setFieldValue('placementKind', PlacementKind.Pinned);
		}
		if (values.machineId !== machineId) {
			this.form.setFieldValue('machineId', machineId);
		}
	}

	#correct = (): void => {
		for (let pass = 0; pass < MAX_CORRECTION_PASSES; pass++) {
			const corrections = fieldCorrectionsFor(
				this.#options().usage,
				this.form.state.values
			);
			if (!hasCorrections(corrections)) return;
			this.#applyCorrections(corrections);
		}
	};

	#applyCorrections(corrections: CreateSandboxFieldCorrections): void {
		const options = { dontRunListeners: true };
		if (corrections.gpu !== undefined) {
			this.form.setFieldValue('gpu', corrections.gpu, options);
		}
		if (corrections.gpuType !== undefined) {
			this.form.setFieldValue('gpuType', corrections.gpuType, options);
		}
		if (corrections.mode) {
			this.form.setFieldValue('mode', corrections.mode, options);
		}
	}

	#goToNextStep = (target: Exclude<WizardSubmitTarget, 'create'>): void => {
		this.step =
			target === 'review'
				? LAST_STEP_INDEX
				: Math.min(this.step + 1, LAST_STEP_INDEX);
	};

	#create = async (values: CreateSandboxValues): Promise<void> => {
		let sandbox: CreateSandbox;
		try {
			sandbox = toCreateSandbox(
				values,
				this.#secretsQuery.data ?? [],
				this.#volumesQuery.data ?? []
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Invalid sandbox configuration'
			);
			return;
		}
		const created = await submitMutation(() => this.#submitSandbox(sandbox));
		if (created) this.reset();
	};

	#submitSandbox = async (sandbox: CreateSandbox): Promise<void> => {
		this.#placementFailure = null;
		const created = await this.#createMutation
			.mutateAsync({
				body: withAcceptedPrice(sandbox, this.#acceptedPriceCardId),
				headers: idempotencyHeaders(),
			})
			.catch((error: unknown) => {
				this.#recordPlacementFailure(error);
				void this.#showFieldErrors(error);
				throw error;
			});
		this.#options().close();
		void goto(
			resolve('/(app)/(dashboard)/sandboxes/[sandboxId]', {
				sandboxId: created.id,
			})
		);
	};

	async #showFieldErrors(error: unknown): Promise<void> {
		const errors = createSandboxFieldErrors(error);
		const step = firstStepWithErrors(errors);
		if (step < FIRST_STEP) return;
		this.step = step;
		await tick();
		setServerFieldErrors(this.form, errors);
		focusFirstInvalidField(this.#formElement);
	}

	#recordPlacementFailure(error: unknown): void {
		const failure = placementError(error);
		this.#placementFailure = failure
			? { error: failure, quote: this.#quote.data }
			: null;
		if (failure?.kind === SandboxPlacementErrorCode.PriceChanged) {
			this.#acceptedPriceCardId = failure.quote.priceCardId;
		}
	}
}
