import { SandboxCodeToolbox } from "../sandbox";
import { CodeRunParams } from "../process";

export class SandboxTsCodeToolbox implements SandboxCodeToolbox {
  private static readonly TS_NODE_CONFIG = '"{\\\"module\\\":\\\"CommonJS\\\"}"';
  private static readonly FILTER_PATTERN = '"npm notice"';

  public getRunCommand(code: string, params?: CodeRunParams): string {
    const base64Code = Buffer.from(code).toString("base64");
    const argv = this.formatArguments(params?.argv);

    return this.buildCommand(base64Code, argv);
  }

  private formatArguments(argv?: string[]): string {
    return argv?.length ? argv.join(" ") : "";
  }

  private buildCommand(base64Code: string, argv: string): string {
    return [
      "sh -c",
      `'echo ${base64Code}`,
      "| base64 --decode",
      `| npx ts-node -O ${SandboxTsCodeToolbox.TS_NODE_CONFIG}`,
      '-e "$(cat)" x',
      argv,
      "2>&1",
      `| grep -vE ${SandboxTsCodeToolbox.FILTER_PATTERN}'`,
    ].join(" ");
  }
}
