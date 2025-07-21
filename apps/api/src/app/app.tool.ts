import { Injectable } from "@nestjs/common";
import { Tool } from "@rekog/mcp-nest";
import { getVersion } from "../common/utils/helpers";

@Injectable()
export class AppTool {
  @Tool({
    name: "get-version",
    description: "Gets the current API version of the API",
  })
  async getVersion() {
    return {
      content: [
        {
          type: "text",
          text: getVersion(),
        },
      ],
    };
  }
}
