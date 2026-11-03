/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type {
	CreateSnapshot,
	OrganizationLimits,
	OrganizationUsageOverview,
} from '@snapflow/api-client';
import { revalidateLogic } from '@tanstack/svelte-form';
import { watch } from 'runed';
import { createAppForm } from '#lib/components/form/create-app-form.ts';
import { focusFirstInvalidField } from '#lib/components/form/focus-first-invalid-field.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import { getGpuOptions } from '#lib/features/machines/lib/gpu-options.ts';
import {
	CREATE_SNAPSHOT_STEPS,
	type CreateSnapshotValues,
	createDefaultValues,
	createSnapshotSchema,
	getAvailableSandboxClasses,
	SANDBOX_CLASS_OPTIONS,
	toCreateSnapshot,
} from '#lib/features/snapshots/lib/create-snapshot-form.ts';

export interface CreateSnapshotWizardOptions {
	limits: OrganizationLimits;
	onCreate: (snapshot: CreateSnapshot) => Promise<void>;
	usage: OrganizationUsageOverview | undefined;
}

interface WizardSubmitMeta {
	advance: boolean;
}

interface SnapshotFormConfig {
	advance: () => void;
	create: (values: CreateSnapshotValues) => Promise<void>;
	defaultValues: () => CreateSnapshotValues;
	focusInvalid: () => void;
	limits: () => OrganizationLimits;
}

const FIRST_STEP = 0;
const LAST_STEP_INDEX = CREATE_SNAPSHOT_STEPS.length - 1;
const DEFAULT_SUBMIT_META: WizardSubmitMeta = { advance: false };

function createSnapshotForm(config: SnapshotFormConfig) {
	return createAppForm(() => ({
		defaultValues: config.defaultValues(),
		onSubmitMeta: DEFAULT_SUBMIT_META,
		validationLogic: revalidateLogic(),
		validators: { onDynamic: createSnapshotSchema(config.limits()) },
		onSubmit: async ({ meta, value }) => {
			if (meta.advance) config.advance();
			else await config.create(value);
		},
		onSubmitInvalid: config.focusInvalid,
	}));
}

export type CreateSnapshotForm = ReturnType<typeof createSnapshotForm>;

export class CreateSnapshotWizard {
	step = $state(FIRST_STEP);
	fieldsElement: HTMLElement | null = $state(null);
	readonly form: CreateSnapshotForm;
	readonly #options: () => CreateSnapshotWizardOptions;
	readonly #values: { readonly current: CreateSnapshotValues };

	readonly #defaultValues = createDefaultValues();
	readonly #selectedQuotaUsage;
	readonly gpuOptions;
	readonly gpuAvailable;
	readonly sandboxClassOptions;
	readonly currentStep = $derived(
		CREATE_SNAPSHOT_STEPS[this.step] ?? CREATE_SNAPSHOT_STEPS[FIRST_STEP]
	);
	readonly selectedClassLabel = $derived(
		SANDBOX_CLASS_OPTIONS.find(
			(option) => option.value === this.values.sandboxClass
		)?.label
	);

	constructor(options: () => CreateSnapshotWizardOptions) {
		this.#options = options;
		this.#selectedQuotaUsage = $derived(
			options().usage?.quotaUsage.find(
				(quotaUsage) => quotaUsage.sandboxClass === this.values.sandboxClass
			)
		);
		this.gpuOptions = $derived(
			getGpuOptions(this.#selectedQuotaUsage?.allowedGpuTypes)
		);
		this.gpuAvailable = $derived(
			(this.#selectedQuotaUsage?.totalGpuQuota ?? 0) > 0 &&
				this.gpuOptions.length > 0
		);
		const availableSandboxClasses = $derived(
			getAvailableSandboxClasses(options().usage)
		);
		this.sandboxClassOptions = $derived(
			SANDBOX_CLASS_OPTIONS.filter((option) =>
				availableSandboxClasses.includes(option.value)
			)
		);
		this.form = createSnapshotForm({
			advance: this.#goToNextStep,
			create: this.#create,
			defaultValues: () => this.#defaultValues,
			focusInvalid: () => focusFirstInvalidField(this.fieldsElement),
			limits: () => this.#options().limits,
		});
		this.#values = this.form.useSelector((state) => state.values);
		watch([() => this.gpuAvailable, () => this.gpuOptions], this.#syncGpu);
	}

	get values(): CreateSnapshotValues {
		return this.#values.current;
	}

	get isLastStep(): boolean {
		return this.step >= LAST_STEP_INDEX;
	}

	requestStep = (next: number): void => {
		if (next <= this.step) {
			this.step = Math.max(FIRST_STEP, next);
			return;
		}
		void this.form.handleSubmit({ advance: true });
	};

	complete = (): void => {
		void this.form.handleSubmit({ advance: false });
	};

	#goToNextStep = (): void => {
		this.step = Math.min(this.step + 1, LAST_STEP_INDEX);
	};

	#create = async (values: CreateSnapshotValues): Promise<void> => {
		const created = await submitMutation(() =>
			this.#options().onCreate(toCreateSnapshot(values))
		);
		if (created) this.reset();
	};

	reset = (): void => {
		this.form.reset(this.#defaultValues);
		this.step = FIRST_STEP;
	};

	#syncGpu = (): void => {
		const wantsGpu = this.form.getFieldValue('gpu');
		if (!this.gpuAvailable) {
			if (wantsGpu) {
				this.form.setFieldValue('gpu', false);
				this.form.setFieldValue('gpuType', '');
			}
			return;
		}
		const [firstOption] = this.gpuOptions;
		const selectedGpuType = this.form.getFieldValue('gpuType');
		if (
			wantsGpu &&
			firstOption &&
			!this.gpuOptions.some((option) => option.value === selectedGpuType)
		) {
			this.form.setFieldValue('gpuType', firstOption.value);
		}
	};
}
