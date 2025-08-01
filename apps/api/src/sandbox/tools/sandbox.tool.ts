import { Injectable } from "@nestjs/common";
import { Context, Tool } from "@rekog/mcp-nest";
import { z } from "zod";
import { OrganizationService } from "../../organization/services/organization.service";
import { BucketDto } from "../dto/bucket.dto";
import { BucketService } from "../services/bucket.service";
import { SandboxService } from "../services/sandbox.service";

@Injectable()
export class BucketTool {
  constructor(private readonly sandboxService: SandboxService) {}
}
