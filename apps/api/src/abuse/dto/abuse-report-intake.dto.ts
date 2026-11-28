/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiProperty,
	ApiPropertyOptional,
	ApiSchema,
	OmitType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	Equals,
	IsDate,
	IsEmail,
	IsEnum,
	IsInt,
	IsIP,
	IsOptional,
	IsString,
	IsUrl,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';
import {
	ABUSE_INTAKE_LIMITS,
	AbuseReportCategory,
} from '../constants/abuse-report.constants';
import { IspComplaintProtocol } from '../constants/isp-complaint.constants';

const MAXIMUM_PORT = 65_535;

@ApiSchema({ name: 'DmcaNotice' })
export class DmcaNoticeDto {
	@ApiProperty({
		description:
			'The copyrighted work claimed to be infringed (17 USC 512(c)(3)(A)(ii))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	copyrightedWork: string;

	@ApiProperty({
		description:
			'The material claimed to be infringing, beyond its URL (17 USC 512(c)(3)(A)(iii))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	infringingMaterial: string;

	@ApiProperty({
		description: 'Postal address of the complaining party (512(c)(3)(A)(iv))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	address: string;

	@ApiProperty({
		description: 'Telephone number of the complaining party (512(c)(3)(A)(iv))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumNameLength)
	phone: string;

	@ApiProperty({
		description:
			'The use is not authorized by the owner, its agent or the law (512(c)(3)(A)(v))',
	})
	@Equals(true)
	goodFaithBelief: boolean;

	@ApiProperty({
		description:
			'The notice is accurate and, under penalty of perjury, the sender is authorized to act for the owner (512(c)(3)(A)(vi))',
	})
	@Equals(true)
	accurateAndAuthorized: boolean;

	@ApiProperty({
		description:
			'Full legal name typed as the electronic signature (512(c)(3)(A)(i))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumSignatureLength)
	signature: string;
}

@ApiSchema({ name: 'CreateAbuseReport' })
export class CreateAbuseReportDto {
	@ApiProperty({ enum: Object.values(AbuseReportCategory) })
	@IsEnum(AbuseReportCategory)
	category: AbuseReportCategory;

	@ApiProperty({
		description:
			'Exact URL of the content; files are never accepted, including for CSAM',
	})
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true })
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumUrlLength)
	url: string;

	@ApiProperty({ description: 'What is wrong with the content' })
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	description: string;

	@ApiPropertyOptional({
		description: 'Optional only for CSAM and threat-to-life reports',
	})
	@IsOptional()
	@IsString()
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumNameLength)
	reporterName?: string;

	@ApiPropertyOptional({
		description: 'Optional only for CSAM and threat-to-life reports',
	})
	@IsOptional()
	@IsEmail()
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumEmailLength)
	reporterEmail?: string;

	@ApiProperty({
		description: 'The reporter believes in good faith the report is accurate',
	})
	@Equals(true)
	goodFaith: boolean;

	@ApiPropertyOptional({
		type: DmcaNoticeDto,
		description: 'Required for copyright reports',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => DmcaNoticeDto)
	dmca?: DmcaNoticeDto;

	@ApiProperty({ description: 'Cloudflare Turnstile response token' })
	@IsString()
	@MinLength(1)
	humanVerificationToken: string;
}

@ApiSchema({ name: 'CreateSignedInAbuseReport' })
export class CreateSignedInAbuseReportDto extends OmitType(
	CreateAbuseReportDto,
	['reporterName', 'reporterEmail', 'humanVerificationToken'] as const
) {}

@ApiSchema({ name: 'IspComplaintDetails' })
export class IspComplaintDetailsDto {
	@ApiProperty({
		description: "The machine's public address named in the complaint",
	})
	@IsIP()
	sourceAddress: string;

	@ApiProperty({ description: 'Destination address named in the complaint' })
	@IsIP()
	destinationAddress: string;

	@ApiPropertyOptional({
		type: 'integer',
		description: 'Destination port, when the complaint names one',
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(MAXIMUM_PORT)
	destinationPort?: number;

	@ApiProperty({ enum: Object.values(IspComplaintProtocol) })
	@IsEnum(IspComplaintProtocol)
	protocol: IspComplaintProtocol;

	@ApiProperty({ type: String, format: 'date-time' })
	@Type(() => Date)
	@IsDate()
	observedFrom: Date;

	@ApiProperty({ type: String, format: 'date-time' })
	@Type(() => Date)
	@IsDate()
	observedUntil: Date;
}

@ApiSchema({ name: 'CreateIspComplaint' })
export class CreateIspComplaintDto extends IspComplaintDetailsDto {
	@ApiProperty({ description: 'The complaint text the ISP sent' })
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	complaintText: string;
}

@ApiSchema({ name: 'AbuseReportReceipt' })
export class AbuseReportReceiptDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ type: String, format: 'date-time' })
	respondBy: Date;
}

@ApiSchema({ name: 'DmcaCounterNotice' })
export class DmcaCounterNoticeDto {
	@ApiProperty({
		description:
			'The material that was removed or disabled and where it appeared before (17 USC 512(g)(3)(B))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	removedMaterial: string;

	@ApiProperty({
		description:
			'Under penalty of perjury, the material was removed as a result of mistake or misidentification (512(g)(3)(C))',
	})
	@Equals(true)
	goodFaithMistake: boolean;

	@ApiProperty({
		description:
			'Consent to the jurisdiction of the Federal District Court and to accept service of process from the complainant (512(g)(3)(D))',
	})
	@Equals(true)
	consentToJurisdiction: boolean;

	@ApiProperty({
		description: 'Postal address of the subscriber (512(g)(3)(D))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	address: string;

	@ApiProperty({
		description: 'Telephone number of the subscriber (512(g)(3)(D))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumNameLength)
	phone: string;

	@ApiProperty({
		description:
			'Full legal name typed as the electronic signature (512(g)(3)(A))',
	})
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumSignatureLength)
	signature: string;
}

@ApiSchema({ name: 'AppealAbuseDecision' })
export class AppealAbuseDecisionDto {
	@ApiProperty({ description: 'Why the decision should be reversed' })
	@IsString()
	@MinLength(1)
	@MaxLength(ABUSE_INTAKE_LIMITS.maximumTextLength)
	appeal: string;

	@ApiPropertyOptional({
		type: DmcaCounterNoticeDto,
		description: 'Required when the case includes a copyright report',
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => DmcaCounterNoticeDto)
	counterNotice?: DmcaCounterNoticeDto;
}
