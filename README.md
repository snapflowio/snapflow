> [!CAUTION]
> Snapflow is very much in early development, and things may change or break without notice!

<br />
<div align="center">
  <a href="https://github.com/snapflowio/snapflow">
    <img src="assets/logo.png" alt="Logo" width="99" height="51">
  </a>

<h3 align="center">Snapflow</h3>
  <p align="center">
    Isolated and fast sandbox environments for AI agents, code execution, automation and more.
    <br />
    <a href="https://snapflow.io/docs"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://snapflow.io">Mothership</a>
    &middot;
    <a href="https://github.com/snapflowio/snapflow/issues/new?labels=bug&template=bug_report.md">Report Bug</a>
    &middot;
    <a href="https://github.com/snapflowio/snapflow/issues/new?labels=enhancement&template=feature_request.md">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About</a>
      <ul>
        <li><a href="#tech-stack">Tech Stack</a></li>
      </ul>
    </li>
    <li><a href="#quick-start">Quick Start</a></li>
    <li><a href="#self-hosting">Self Hosting</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

Snapflow provides on-demand sandbox environments that are isolated, fast, and disposable. Each sandbox runs in its own container with full filesystem, process, git, and network access through a simple SDK.

Use cases include:

- **Environments for AI Agents** - give LLMs full access to a computer safely
- **Code execution** - run untrusted or user-submitted code without risk to your infrastructure
- **Automation** - spin up environments on the fly for CI tasks, testing, or data processing
- **Scraping** - automate browsers in order to scrape the web
- **Development** - create reproducible, throwaway environments for prototyping

### Tech Stack

- Rust
- TypeScript & Bun
- Docker
- React
- PostgreSQL
- Redis
- Cloudflare R2

## Quick Start

Install the SDK:

```sh
npm install @snapflow/sdk
```

Create a sandbox and run code in it:

```typescript
import { Snapflow } from "@snapflow/sdk";

const snapflow = new Snapflow();

const sandbox = await snapflow.sandbox().create();

// Run a command
const result = await sandbox.exec("echo 'Hello from Snapflow!'");
console.log(result.output);

// Write and read files
await sandbox.fs.uploadFile("/home/user/hello.txt", "Hello, world!");
const content = await sandbox.fs.downloadFile("/home/user/hello.txt");

// Clean up
await sandbox.destroy();
```

Set your API key as an environment variable:

```sh
export snapflow_API_KEY="your-api-key"
```

Or pass it directly:

```typescript
const snapflow = new Snapflow({ apiKey: "your-api-key" });
```

For more examples and full API reference, check the [documentation](https://snapflow.io/docs).

## Self Hosting

Coming Soon

## Roadmap

- [x] Beta Release
- [ ] Self hosting guides and setup

See the [open issues](https://github.com/snapflowio/snapflow/issues) for a full list of proposed features (and known issues).

## Contributing

Snapflow is **open source software** licensed under **AGPLv3**. Contributions are welcome.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for development processes and how to propose changes, and [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) for community guidelines.

### Top contributors:

<a href="https://github.com/snapflowio/snapflow/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=snapflowio/snapflow" alt="contrib.rocks image" />
</a>

## Stargazers
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=snapflowio/snapflow&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=snapflowio/snapflow&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/image?repos=snapflowio/snapflow&type=Date" />
</picture>

## License

Distributed under the `AGPLv3`. See `LICENSE` for more information.