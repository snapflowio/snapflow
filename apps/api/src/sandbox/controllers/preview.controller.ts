import { Controller, Get, Logger, NotFoundException, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { SandboxService } from "../services/sandbox.service";

@ApiTags("preview")
@Controller("preview")
export class PreviewController {
  private readonly logger = new Logger(PreviewController.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly sandboxService: SandboxService
  ) {}

  @Get(":sandboxId/public")
  @ApiOperation({
    summary: "Check if sandbox is public",
    operationId: "isSandboxPublic",
  })
  @ApiParam({
    name: "sandboxId",
    description: "ID of the sandbox",
    type: "string",
  })
  @ApiResponse({
    status: 200,
    description: "Public status of the sandbox",
    type: Boolean,
  })
  async isSandboxPublic(@Param("sandboxId") sandboxId: string): Promise<boolean> {
    const cached = await this.redis.get(`preview:public:${sandboxId}`);
    if (cached) {
      if (cached === "1") return true;
      throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
    }

    try {
      const isPublic = await this.sandboxService.isSandboxPublic(sandboxId);
      //  for private sandboxes, throw 404 as well
      //  to prevent using the method to check if a sandbox exists
      if (!isPublic) {
        //  cache the result for 3 seconds to avoid unnecessary requests to the database
        await this.redis.setex(`preview:public:${sandboxId}`, 3, "0");

        throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
      }
      //  cache the result for 3 seconds to avoid unnecessary requests to the database
      await this.redis.setex(`preview:public:${sandboxId}`, 3, "1");
      return true;
    } catch (ex) {
      if (ex instanceof NotFoundException) {
        //  cache the not found sandbox as well
        //  as it is the same case as for the private sandboxes
        await this.redis.setex(`preview:public:${sandboxId}`, 3, "0");
        throw ex;
      }
      throw ex;
    }
  }
}
