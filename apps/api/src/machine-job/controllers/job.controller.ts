/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Body,
	Controller,
	Get,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	Post,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UseGuards,
} from '@nestjs/common';
import {
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PublicEndpoint } from '../../auth/decorators/public-endpoint.decorator';
import { IsMachineAuthContext } from '../../common/decorators/auth-context.decorator';
import { AuthenticatedRateLimitGuard } from '../../common/guards/authenticated-rate-limit.guard';
import type { MachineAuthContext } from '../../common/types/machine-auth-context.types';
import { errorMessage, errorStack } from '../../common/utils/error/error.util';
import { CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS } from '../../infra/control-wake/constants/control-wake.constants';
import { ActiveMachineSession } from '../../machine/decorators/machine-session.decorator';
import type { MachineSession } from '../../machine/entities/machine-session.entity';
import { MachineSessionGuard } from '../../machine/guards/machine-session.guard';
import {
	JOB_CONTROLLER_PATH,
	JOB_STATUS_ROUTE,
} from '../constants/job-execution.constants';
import {
	JobDto,
	JobPageDto,
	JobStatus,
	ListJobsQueryDto,
	PollJobsRequestDto,
	PollJobsResponseDto,
	RenewJobLeaseDto,
	UpdateJobStatusDto,
} from '../dto/job.dto';
import { JobAccessGuard } from '../guards/job-access.guard';
import { JobService } from '../services/job.service';
import { JobCompletionService } from '../services/job-completion.service';
import { JobLeaseService } from '../services/job-lease.service';
import { JobPollService } from '../services/job-poll.service';

const JOB_POLL_SHUTDOWN_RETRY_SECONDS = 5;

@Controller(JOB_CONTROLLER_PATH)
@ApiTags('jobs')
@PublicEndpoint()
@UseGuards(MachineSessionGuard, AuthenticatedRateLimitGuard)
export class JobController {
	private readonly logger = new Logger(JobController.name);

	constructor(
		private readonly jobService: JobService,
		private readonly jobPolls: JobPollService,
		private readonly jobCompletions: JobCompletionService,
		private readonly jobLeases: JobLeaseService
	) {}

	@Get()
	@ApiOperation({
		summary: 'List jobs for the machine',
		operationId: 'listJobs',
		description:
			'Returns a paginated list of jobs for the machine, optionally filtered by status.',
	})
	@ApiQuery({
		name: 'status',
		required: false,
		enum: JobStatus,
		enumName: 'JobStatus',
		example: JobStatus.PENDING,
		description: 'Filter jobs by status',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Maximum number of jobs to return (default: 100, max: 500)',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of jobs for the machine',
		type: JobPageDto,
	})
	async listJobs(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Query() query: ListJobsQueryDto
	): Promise<JobPageDto> {
		return this.jobService.findJobsForMachine(
			machineContext.machineId,
			query.status,
			query.limit,
			query.cursor
		);
	}

	@Get('poll')
	@ApiOperation({
		summary: 'Long poll for jobs',
		operationId: 'pollJobs',
		description:
			'Long poll endpoint for machines to fetch pending jobs. Returns immediately if jobs are available, otherwise waits up to timeout seconds.',
	})
	@ApiQuery({
		name: 'timeout',
		required: false,
		type: Number,
		description: `Timeout in seconds for long polling (default and maximum: ${CONTROL_LONG_POLL_MAXIMUM_WAIT_SECONDS})`,
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: Number,
		description: 'Maximum number of jobs to return (default: 10, max: 100)',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of jobs for the machine',
		type: PollJobsResponseDto,
	})
	async pollJobs(
		@Req() req: Request,
		@Res({ passthrough: true }) response: Response,
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() machineSession: MachineSession,
		@Query() query: PollJobsRequestDto
	): Promise<PollJobsResponseDto> {
		this.logger.debug(
			`Machine ${machineContext.machineId} polling for jobs (timeout: ${query.timeout}s, limit: ${query.limit})`
		);

		const abortController = new AbortController();
		const onClose = () => {
			this.logger.debug(
				`Machine ${machineContext.machineId} disconnected during polling, aborting`
			);
			abortController.abort();
		};
		req.on('close', onClose);

		try {
			const jobs = await this.jobPolls.pollJobs(
				machineContext.machineId,
				machineSession.id,
				query.limit,
				query.timeout,
				abortController.signal
			);
			this.logger.debug(
				`Returning ${jobs.length} jobs to machine ${machineContext.machineId}`
			);
			return { jobs };
		} catch (error: unknown) {
			if (abortController.signal.aborted) {
				this.logger.debug(
					`Polling aborted for disconnected machine ${machineContext.machineId}`
				);
				return { jobs: [] };
			}
			if (error instanceof ServiceUnavailableException) {
				response.setHeader('Connection', 'close');
				response.setHeader('Retry-After', JOB_POLL_SHUTDOWN_RETRY_SECONDS);
			}
			this.logger.error(
				`Error polling jobs for machine ${machineContext.machineId}: ${errorMessage(error)}`,
				errorStack(error)
			);
			throw error;
		} finally {
			req.off('close', onClose);
		}
	}

	@Get(':jobId')
	@ApiOperation({
		summary: 'Get job details',
		operationId: 'getJob',
	})
	@ApiParam({
		name: 'jobId',
		description: 'ID of the job',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job details',
		type: JobDto,
	})
	@UseGuards(JobAccessGuard)
	async getJob(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@Param('jobId') jobId: string
	): Promise<JobDto> {
		this.logger.log(
			`Machine ${machineContext.machineId} fetching job ${jobId}`
		);

		const job = await this.jobService.findOne(jobId);
		if (!job) {
			throw new NotFoundException(`Job ${jobId} not found`);
		}

		return new JobDto(job);
	}

	@Post(JOB_STATUS_ROUTE)
	@ApiOperation({
		summary: 'Update job status',
		operationId: 'updateJobStatus',
	})
	@ApiParam({
		name: 'jobId',
		description: 'ID of the job',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job status updated successfully',
		type: JobDto,
	})
	@UseGuards(JobAccessGuard)
	async updateJobStatus(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() machineSession: MachineSession,
		@Param('jobId') jobId: string,
		@Body() updateJobStatusDto: UpdateJobStatusDto
	): Promise<JobDto> {
		this.logger.debug(
			`Machine ${machineContext.machineId} updating job ${jobId} status to ${updateJobStatusDto.status}`
		);

		const job = await this.jobCompletions.complete({
			machineId: machineContext.machineId,
			machineSessionId: machineSession.id,
			jobId,
			status: updateJobStatusDto.status,
			leaseToken: updateJobStatusDto.leaseToken,
			attempt: updateJobStatusDto.attempt,
			errorMessage: updateJobStatusDto.errorMessage,
			resultMetadata: updateJobStatusDto.resultMetadata,
			executionResult: updateJobStatusDto.executionResult,
		});

		return new JobDto(job);
	}

	@Post(':jobId/lease')
	@ApiOperation({
		summary: 'Renew an active job lease',
		operationId: 'renewJobLease',
	})
	@ApiParam({
		name: 'jobId',
		description: 'ID of the job',
		type: 'string',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job lease renewed successfully',
		type: JobDto,
	})
	@UseGuards(JobAccessGuard)
	async renewJobLease(
		@IsMachineAuthContext() machineContext: MachineAuthContext,
		@ActiveMachineSession() machineSession: MachineSession,
		@Param('jobId') jobId: string,
		@Body() renewJobLeaseDto: RenewJobLeaseDto
	): Promise<JobDto> {
		return this.jobLeases.renewLease(
			machineContext.machineId,
			machineSession.id,
			jobId,
			renewJobLeaseDto.leaseToken,
			renewJobLeaseDto.attempt
		);
	}
}
