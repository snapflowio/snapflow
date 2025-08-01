import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOAuth2,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CombinedAuthGuard } from "../../auth/guards/auth.guard";
import { ProxyGuard } from "../../auth/guards/proxy.guard";
import { SystemActionGuard } from "../../auth/guards/system-action.guard";
import { RequiredApiRole } from "../../common/decorators/required-role.decorator";
import { SystemRole } from "../../user/enums/system-role.enum";
import { CreateExecutorDto } from "../dto/create-executor.dto";
import { ExecutorDto } from "../dto/executor.dto";
import { ExecutorImageDto } from "../dto/executor-image.dto";
import { Executor } from "../entities/executor.entity";
import { ExecutorService } from "../services/executor.service";

@ApiTags("executors")
@Controller("executors")
@UseGuards(CombinedAuthGuard, SystemActionGuard, ProxyGuard)
@RequiredApiRole([SystemRole.ADMIN, "proxy"])
@ApiOAuth2(["openid", "profile", "email"])
@ApiBearerAuth()
export class ExecutorController {
  constructor(private readonly executorService: ExecutorService) {}

  @Post()
  @ApiOperation({
    summary: "Create executor",
    operationId: "createExecutor",
  })
  async create(@Body() createExecutorDto: CreateExecutorDto): Promise<Executor> {
    return this.executorService.create(createExecutorDto);
  }

  @Get()
  @ApiOperation({
    summary: "List all executors",
    operationId: "listExecutors",
  })
  async findAll(): Promise<Executor[]> {
    return this.executorService.findAll();
  }

  @Patch(":id/scheduling")
  @ApiOperation({
    summary: "Update executor scheduling status",
    operationId: "updateExecutorScheduling",
  })
  async updateSchedulingStatus(
    @Param("id") id: string,
    @Body("unschedulable") unschedulable: boolean
  ): Promise<Executor> {
    return this.executorService.updateSchedulingStatus(id, unschedulable);
  }

  @Get("/by-sandbox/:sandboxId")
  @ApiOperation({
    summary: "Get executor by sandbox ID",
    operationId: "getExecutorBySandboxId",
  })
  @ApiResponse({
    status: 200,
    description: "Executor found",
    type: ExecutorDto,
  })
  async getExecutorBySandboxId(@Param("sandboxId") sandboxId: string): Promise<ExecutorDto> {
    const executor = await this.executorService.findBySandboxId(sandboxId);
    return ExecutorDto.fromExecutor(executor);
  }

  @Get("/by-image")
  @ApiOperation({
    summary: "Get executors by image internal name",
    operationId: "getExecutorsByImageInternalName",
  })
  @ApiQuery({
    name: "internalName",
    description: "Internal name of the image",
    type: String,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: "Executors found for the image",
    type: [ExecutorImageDto],
  })
  async getExecutorsByImageInternalName(
    @Query("internalName") internalName: string
  ): Promise<ExecutorImageDto[]> {
    return this.executorService.getExecutorsByImageInternalName(internalName);
  }
}
