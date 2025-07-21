import { Injectable } from "@nestjs/common";
import { Tool } from "@rekog/mcp-nest";

@Injectable()
export class BucketTool {
  @Tool({
    name: "create-bucket",
    description: "Creates a storage bucket for sandboxes",
  })
  async createBucket() {
    return {
      content: [
        {
          type: "text",
          text: "hello",
        },
      ],
    };
  }
}
