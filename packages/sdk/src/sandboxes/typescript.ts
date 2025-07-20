import { SandboxCodeToolbox } from '../sandbox'
import { CodeRunParams } from '../process'

export class SandboxTsCodeToolbox implements SandboxCodeToolbox {
  public getRunCommand(code: string, params?: CodeRunParams): string {
    const base64Code = Buffer.from(code).toString('base64')
    const argv = params?.argv ? params.argv.join(' ') : ''

    return `sh -c 'echo ${base64Code} | base64 --decode | npx ts-node -O "{\\\"module\\\":\\\"CommonJS\\\"}" -e "$(cat)" x ${argv} 2>&1 | grep -vE "npm notice"'`
  }
}