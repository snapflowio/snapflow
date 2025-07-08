import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOAuth2,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { CombinedAuthGuard } from "../../auth/guards/combined-auth.guard";
import { ProxyGuard } from "../../auth/guards/proxy.guard";
import { SystemActionGuard } from "../../auth/guards/system-action.guard";
import { RequiredApiRole } from "../../common/decorators/required-role.decorator";
import { SystemRole } from "../../user/enums/system-role.enum";
import { CreateRunnerDto } from "../dto/create-runner.dto";
import { RunnerDto } from "../dto/runner.dto";
import { RunnerSnapshotDto } from "../dto/runner-snapshot.dto";
import { Runner } from "../entities/runner.entity";
import { RunnerService } from "../services/runner.service";

@ApiTags("runners")
@Controller("runners")
@UseGuards(CombinedAuthGuard, SystemActionGuard, ProxyGuard)
@RequiredApiRole([SystemRole.ADMIN, "proxy"])
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class RunnerController {
  constructor(private readonly runnerService: RunnerService) {}

  @Post()
  @ApiOperation({
    summary: "Create runner",
    operationId: "createRunner",
  })
  async create(@Body() createRunnerDto: CreateRunnerDto): Promise<Runner> {
    return this.runnerService.create(createRunnerDto);
  }

  @Get()
  @ApiOperation({
    summary: "List all runners",
    operationId: "listRunners",
  })
  async findAll(): Promise<Runner[]> {
    return this.runnerService.findAll();
  }

  @Patch(":id/scheduling")
  @ApiOperation({
    summary: "Update runner scheduling status",
    operationId: "updateRunnerScheduling",
  })
  async updateSchedulingStatus(
    @Param("id") id: string,
    @Body("unschedulable") unschedulable: boolean,
  ): Promise<Runner> {
    return this.runnerService.updateSchedulingStatus(id, unschedulable);
  }

  @Get("/by-sandbox/:sandboxId")
  @ApiOperation({
    summary: "Get runner by sandbox ID",
    operationId: "getRunnerBySandboxId",
  })
  @ApiResponse({
    status: 200,
    description: "Runner found",
    type: RunnerDto,
  })
  async getRunnerBySandboxId(
    @Param("sandboxId") sandboxId: string,
  ): Promise<RunnerDto> {
    const runner = await this.runnerService.findBySandboxId(sandboxId);
    return RunnerDto.fromRunner(runner);
  }

  @Get("/by-snapshot")
  @ApiOperation({
    summary: "Get runners by snapshot internal name",
    operationId: "getRunnersBySnapshotInternalName",
  })
  @ApiQuery({
    name: "internalName",
    description: "Internal name of the snapshot",
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Runners found for the snapshot",
    type: [RunnerSnapshotDto],
  })
  async getRunnersBySnapshotInternalName(
    @Query("internalName") internalName: string,
  ): Promise<RunnerSnapshotDto[]> {
    return this.runnerService.getRunnersBySnapshotInternalName(internalName);
  }
}
