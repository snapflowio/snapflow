/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { HttpStatus } from '@nestjs/common';
import { AbuseErrorCode } from '../../abuse/constants/abuse.constants';
import { AbuseReportErrorCode } from '../../abuse/constants/abuse-report.constants';
import { AUTH_ERROR } from '../../auth/constants/auth-errors.constants';
import { MachineEnrollmentKeyErrorCode } from '../../auth/constants/machine-enrollment-key.constants';
import { AuthErrorCode } from '../../auth/enums/auth-error-code.enum';
import {
	BillingAdmissionErrorCode,
	BillingBudgetErrorCode,
} from '../../billing/constants/billing-admission.constants';
import { BillingReceiptErrorCode } from '../../billing/constants/billing-receipt.constants';
import { BillingStatementErrorCode } from '../../billing/constants/billing-statement.constants';
import { BillingErrorCode } from '../../billing/enums/billing-error-code.enum';
import { BillingRestriction } from '../../billing/enums/billing-restriction.enum';
import { CloudflareErrorCode } from '../../cloudflare/enums/cloudflare-error-code.enum';
import { CustomDomainErrorCode } from '../../custom-domain/enums/custom-domain-error-code.enum';
import { ECR_REGISTRY_ROLE_FORBIDDEN } from '../../docker-registry/constants/ecr-credentials.constants';
import { PLATFORM_REGISTRY_IMAGE_FORBIDDEN } from '../../docker-registry/constants/platform-registry-image.constants';
import { DockerRegistryErrorCode } from '../../docker-registry/enums/docker-registry-error-code.enum';
import { IDEMPOTENCY_PROBLEM_CODE } from '../../idempotency/constants/idempotency.constants';
import { LegalErrorCode } from '../../legal/constants/legal-documents.constants';
import { LocationErrorCode } from '../../location/constants/sanctioned-region.constants';
import { MACHINE_REMOVED_CODE } from '../../machine/constants/machine-connection.constants';
import { MachineEnrollmentErrorCode } from '../../machine/constants/machine-enrollment.constants';
import { MachineHostSettingsErrorCode } from '../../machine/constants/machine-host-settings.constants';
import { MachineApiErrorCode } from '../../machine/enums/machine-api-error-code.enum';
import { MachineJobApiErrorCode } from '../../machine-job/enums/machine-job-api-error-code.enum';
import { HostProfileErrorCode } from '../../marketplace/constants/host-profile.constants';
import { MarketplaceErrorCode } from '../../marketplace/enums/marketplace-error-code.enum';
import { NetworkingErrorCode } from '../../networking/enums/networking-error-code.enum';
import { ObjectStorageErrorCode } from '../../object-storage/enums/object-storage-error-code.enum';
import {
	ACCOUNT_HAS_LIVE_RESOURCES_CODE,
	ACCOUNT_OWNS_SHARED_ORGANIZATIONS_CODE,
	ORGANIZATION_HAS_LIVE_RESOURCES_CODE,
} from '../../organization/constants/live-organization-resource.constants';
import { ORGANIZATION_ERROR } from '../../organization/constants/organization-errors.constants';
import { StorageErrorCode } from '../../organization/constants/organization-limits.constants';
import { OrganizationErrorCode } from '../../organization/enums/organization-error-code.enum';
import { QuotaIncreaseRequestErrorCode } from '../../organization/enums/quota-increase-request-error-code.enum';
import { PlacementErrorCode } from '../../placement/enums/placement-error-code.enum';
import { SandboxErrorCode } from '../../sandbox/enums/sandbox-error-code.enum';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { SECRET_PROBLEM_CODE } from '../../secrets/constants/secret.constants';
import { SETTINGS_PROBLEM_CODE } from '../../settings/constants/settings.constants';
import { AutoTopUpErrorCode } from '../../settlement/constants/auto-top-up.constants';
import { HeldFundsErrorCode } from '../../settlement/constants/held-funds.constants';
import { HostSettlementErrorCode } from '../../settlement/constants/host-settlement.constants';
import { SettlementErrorCode } from '../../settlement/constants/payment-channel.constants';
import { PaymentWalletErrorCode } from '../../settlement/constants/payment-wallet.constants';
import { UserWalletErrorCode } from '../../settlement/constants/user-wallet.constants';
import { SnapshotErrorCode } from '../../snapshot/enums/snapshot-error-code.enum';
import { ADMIN_MFA_REQUIRED_CODE } from '../../user/constants/admin-access.constants';
import { UserErrorCode } from '../../user/enums/user-error-code.enum';
import { BenchmarkBlocker } from '../../verification/enums/benchmark-blocker.enum';
import { VerificationErrorCode } from '../../verification/enums/verification-error-code.enum';
import { VolumeErrorCode } from '../../volume/enums/volume-error-code.enum';
import { CommonErrorCode } from '../enums/common-error-code.enum';
import { PLATFORM_PROBLEM_CODE } from './platform-trust.constants';

export const API_ERROR_CODE_SCHEMA_NAME = 'ApiErrorCode';

const REGISTERED_API_ERROR_CODES = [
	...Object.values(CommonErrorCode),
	...Object.values(SandboxErrorCode),
	...Object.values(SandboxPlacementErrorCode),
	...Object.values(SnapshotErrorCode),
	...Object.values(VolumeErrorCode),
	...Object.values(BillingRestriction),
	...Object.values(BillingAdmissionErrorCode),
	...Object.values(BillingBudgetErrorCode),
	...Object.values(BillingStatementErrorCode),
	...Object.values(BillingReceiptErrorCode),
	...Object.values(MarketplaceErrorCode),
	...Object.values(HostProfileErrorCode),
	...Object.values(SettlementErrorCode),
	...Object.values(HostSettlementErrorCode),
	...Object.values(AutoTopUpErrorCode),
	...Object.values(PaymentWalletErrorCode),
	...Object.values(UserWalletErrorCode),
	...Object.values(HeldFundsErrorCode),
	...Object.values(LegalErrorCode),
	...Object.values(PLATFORM_PROBLEM_CODE),
	...Object.values(IDEMPOTENCY_PROBLEM_CODE),
	...Object.values(SECRET_PROBLEM_CODE),
	...Object.values(SETTINGS_PROBLEM_CODE),
	...Object.values(MachineEnrollmentKeyErrorCode),
	...Object.values(MachineEnrollmentErrorCode),
	...Object.values(MachineHostSettingsErrorCode),
	...Object.values(StorageErrorCode),
	...Object.values(ORGANIZATION_ERROR).map(({ code }) => code),
	...Object.values(AUTH_ERROR).map(({ code }) => code),
	MACHINE_REMOVED_CODE,
	ADMIN_MFA_REQUIRED_CODE,
	ACCOUNT_HAS_LIVE_RESOURCES_CODE,
	ACCOUNT_OWNS_SHARED_ORGANIZATIONS_CODE,
	ORGANIZATION_HAS_LIVE_RESOURCES_CODE,
	ECR_REGISTRY_ROLE_FORBIDDEN,
	PLATFORM_REGISTRY_IMAGE_FORBIDDEN,
	...Object.values(UserErrorCode),
	...Object.values(OrganizationErrorCode),
	...Object.values(QuotaIncreaseRequestErrorCode),
	...Object.values(ObjectStorageErrorCode),
	...Object.values(DockerRegistryErrorCode),
	...Object.values(VerificationErrorCode),
	...Object.values(BenchmarkBlocker),
	...Object.values(CustomDomainErrorCode),
	...Object.values(CloudflareErrorCode),
	...Object.values(MachineJobApiErrorCode),
	...Object.values(PlacementErrorCode),
	...Object.values(AuthErrorCode),
	...Object.values(BillingErrorCode),
	...Object.values(MachineApiErrorCode),
	...Object.values(NetworkingErrorCode),
	...Object.values(AbuseErrorCode),
	...Object.values(AbuseReportErrorCode),
	...Object.values(LocationErrorCode),
] as const;

export const API_ERROR_CODES = [...new Set(REGISTERED_API_ERROR_CODES)];

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const STATUS_ERROR_CODES: Readonly<
	Partial<Record<number, CommonErrorCode>>
> = {
	[HttpStatus.BAD_REQUEST]: CommonErrorCode.BAD_REQUEST,
	[HttpStatus.UNAUTHORIZED]: CommonErrorCode.UNAUTHORIZED,
	[HttpStatus.PAYMENT_REQUIRED]: CommonErrorCode.PAYMENT_REQUIRED,
	[HttpStatus.FORBIDDEN]: CommonErrorCode.FORBIDDEN,
	[HttpStatus.NOT_FOUND]: CommonErrorCode.NOT_FOUND,
	[HttpStatus.CONFLICT]: CommonErrorCode.CONFLICT,
	[HttpStatus.GONE]: CommonErrorCode.GONE,
	[HttpStatus.PAYLOAD_TOO_LARGE]: CommonErrorCode.PAYLOAD_TOO_LARGE,
	[HttpStatus.UNPROCESSABLE_ENTITY]: CommonErrorCode.UNPROCESSABLE,
	[HttpStatus.TOO_MANY_REQUESTS]: CommonErrorCode.RATE_LIMITED,
	[HttpStatus.INTERNAL_SERVER_ERROR]: CommonErrorCode.INTERNAL_ERROR,
	[HttpStatus.SERVICE_UNAVAILABLE]: CommonErrorCode.SERVICE_UNAVAILABLE,
	[HttpStatus.GATEWAY_TIMEOUT]: CommonErrorCode.GATEWAY_TIMEOUT,
};

export const COMMON_ERROR_MESSAGES: Readonly<Record<CommonErrorCode, string>> =
	{
		[CommonErrorCode.BAD_REQUEST]:
			'The request is invalid. Check the parameters and try again.',
		[CommonErrorCode.VALIDATION_FAILED]:
			'Some fields are invalid. Correct them and try again.',
		[CommonErrorCode.INVALID_JSON]:
			'The request body is not valid JSON. Fix the body and try again.',
		[CommonErrorCode.CURSOR_INVALID]:
			'The pagination cursor is invalid or expired. Start again from the first page.',
		[CommonErrorCode.RESOURCE_VERSION_REQUIRED]:
			'This request needs an If-Match header with the resource version. Fetch the resource and send its version.',
		[CommonErrorCode.RESOURCE_VERSION_INVALID]:
			'The If-Match header does not hold a valid resource version. Fetch the resource and send its current version.',
		[CommonErrorCode.UNAUTHORIZED]:
			'Your session or API key is missing or has expired. Sign in again or use a valid API key.',
		[CommonErrorCode.PAYMENT_REQUIRED]:
			'This action needs more funds. Add funds on the Funding page and try again.',
		[CommonErrorCode.FORBIDDEN]:
			'You do not have permission to do this. Ask an owner or admin of the organization for access.',
		[CommonErrorCode.ACCESS_DENIED]:
			'You do not have access to this resource. Ask an owner or admin of the organization for access.',
		[CommonErrorCode.INVALID_AUTHENTICATION_CONTEXT]:
			'These credentials cannot be used for this request. Sign in again or use an API key of this organization.',
		[CommonErrorCode.NOT_FOUND]:
			'The requested resource was not found. Check the ID or name and try again.',
		[CommonErrorCode.CONFLICT]:
			'The request conflicts with the current state of the resource. Reload it and try again.',
		[CommonErrorCode.RESOURCE_MODIFIED]:
			'The resource was changed by another request. Reload it and try again.',
		[CommonErrorCode.OPERATION_IN_PROGRESS]:
			'Another operation is already running on this resource. Wait for it to finish and try again.',
		[CommonErrorCode.GONE]: 'The resource no longer exists.',
		[CommonErrorCode.PAYLOAD_TOO_LARGE]:
			'The request is too large. Send a smaller payload.',
		[CommonErrorCode.UNPROCESSABLE]:
			'The request could not be processed. Check the values and try again.',
		[CommonErrorCode.RATE_LIMITED]:
			'Too many requests. Wait a moment and try again.',
		[CommonErrorCode.INTERNAL_ERROR]:
			'An unexpected error occurred. Try again; if it keeps happening, contact support@snapflow.io.',
		[CommonErrorCode.SERVICE_UNAVAILABLE]:
			'The service is temporarily unavailable. Try again in a moment.',
		[CommonErrorCode.GATEWAY_TIMEOUT]:
			'The request timed out. Try again in a moment.',
		[CommonErrorCode.REQUEST_FAILED]: 'The request failed. Try again.',
	};
