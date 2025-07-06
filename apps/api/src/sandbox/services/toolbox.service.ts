import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import { Repository } from "typeorm";
import { Runner } from "../entities/runner.entity";
import { Sandbox } from "../entities/sandbox.entity";
import { SandboxState } from "../enums/sandbox-state.enum";

@Injectable()
export class ToolboxService {
  private readonly logger = new Logger(ToolboxService.name);

  constructor(
    @InjectRepository(Sandbox)
    private readonly sandboxRepository: Repository<Sandbox>,
    @InjectRepository(Runner)
    private readonly runnerRepository: Repository<Runner>
  ) {}

  async forwardRequestToRunner(
    sandboxId: string,
    method: string,
    path: string,
    data?: any
  ): Promise<any> {
    const runner = await this.getRunner(sandboxId);

    const maxRetries = 5;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        const headers: any = {
          Authorization: `Bearer ${runner.apiKey}`,
        };

        if (data && typeof data === "object" && Object.keys(data).length > 0)
          headers["Content-Type"] = "application/json";

        const requestConfig: any = {
          method,
          url: `${runner.apiUrl}/sandboxes/${sandboxId}${path}`,
          headers,
          maxBodyLength: 209715200, // 200MB in bytes
          maxContentLength: 209715200, // 200MB in bytes
          timeout: 360000, // 360 seconds
        };

        if (data !== undefined && data !== "") requestConfig.data = data;

        const response = await axios(requestConfig);
        return response.data;
      } catch (error) {
        if (error.message.includes("ECONNREFUSED")) {
          if (attempt === maxRetries) {
            throw new HttpException("Failed to connect to runner after multiple attempts", 500);
          }
          // Wait for attempt * 1000ms (1s, 2s, 3s)
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          attempt++;
          continue;
        }

        if (error.response) throw new HttpException(error.response.data, error.response.status);

        throw new HttpException(`Error forwarding request to runner: ${error.message}`, 500);
      }
    }
  }

  public async getRunner(sandboxId: string): Promise<Runner> {
    try {
      const sandbox = await this.sandboxRepository.findOne({
        where: { id: sandboxId },
      });

      if (!sandbox) throw new NotFoundException("Sandbox not found");

      const runner = await this.runnerRepository.findOne({
        where: { id: sandbox.runnerId },
      });

      if (!runner) throw new NotFoundException("Runner not found for the sandbox");

      if (sandbox.state !== SandboxState.STARTED)
        throw new BadRequestException("Sandbox is not running");

      return runner;
    } finally {
      await this.sandboxRepository.update(sandboxId, {
        lastActivityAt: new Date(),
      });
    }
  }
}
