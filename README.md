<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/snapflowio/snapflow">
    <img src="https://raw.githubusercontent.com/snapflowio/.github/refs/heads/main/assets/logo.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Snapflow</h3>

  <p align="center">
    Open-source gamified productivity and social platform for students
    <br />
    <br />
    <a href="https://app.snapflow.io">View Demo</a>
    ·
    <a href="https://github.com/snapflowio/snapflow/issues/new?labels=bug&template=bug_report.yml">Report Bug</a>
    ·
    <a href="https://github.com/snapflowio/snapflow/issues/new?labels=enhancement&template=feature_request.yml">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#key-features">Key Features</a></li>
        <li><a href="#built-with">Built With</a></li>
        <li><a href="#architecture">Architecture</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#deployment">Deployment</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

Snapflow is a **gamified productivity and social platform** designed specifically for students to maximize their efficiency and reduce cognitive load. By combining competitive features, social learning tools, gameified aspects, and productivity workflows, Snapflow helps students focus on what matters most—achieving their academic goals with less stress and more success.

### Key Features

🎯 **Gamified Experience**
- Earn badges and achievements for completing study goals
- Track your progress with detailed analytics and insights
- Build study streaks and participate in productivity challenges
- Compete against other schools in a variety of daily games and challenges

👥 **Studying Powerhouse**
- Create study groups with friends and classmates
- Share resources and collaborate on projects in real-time
- Organize workspaces by subject, course, or study group
- Realtime AI notebooks, built with our own custom models
- Flashcards automatically generated from your notes
- Practice quizes based on notes and AI predictions
- Powerful researching tool for papers

🌟 **Grow your friend circle and network**
- Connect with fellow students or schools in your network
- Stay up to date with the latest news and events at your school
- Compete in a variety of challenges and games against other students and schools
- **[App]** Looking for a roomate? Find someone with similar intrests
- **[App]** Proximity chat for large events at your campus, grow your network and make new friends

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

**Frontend:**
* [![React][React.js]][React-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![TailwindCSS][TailwindCSS]][TailwindCSS-url]
* [![Vite][Vite]][Vite-url]

**Backend:**
* [![NestJS][NestJS]][NestJS-url]
* [![Node.js][Node.js]][Node-url]
* [![PostgreSQL][PostgreSQL]][PostgreSQL-url]
* [![Redis][Redis]][Redis-url]

**Tools & Infrastructure:**
* [![Nx][Nx]][Nx-url]
* [![Docker][Docker]][Docker-url]
* [![Bun][Bun]][Bun-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Architecture

This is a **Nx monorepo** with the following structure:

```
snapflow/
├── apps/
│   ├── api/          # NestJS REST API
│   └── website/      # React SPA with TanStack Router
├── packages/
│   ├── api-client/   # Generated TypeScript API client
│   └── auth/         # Shared authentication utilities
└── examples/         # Example implementations
```

**Key Technologies:**
- **Monorepo Management:** Nx workspace with parallel builds and caching
- **API:** NestJS with Drizzle ORM, Better Auth, and OpenAPI documentation
- **Frontend:** React 19 with TanStack Router, Tailwind CSS v4, and Radix UI
- **Database:** PostgreSQL with automated migrations
- **Real-time:** Socket.io with Redis adapter
- **Build System:** Vite, Webpack, and Bun package manager

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

### Phase 1: Core Features ✅
- [x] User authentication and profiles
- [x] Workspace management with permissions
- [x] Dev tooling
- [x] Core foundation

### Phase 2: MVP Features - Productivity 🚧
- [ ] AI Calendar integration
- [ ] AI notebooks
- [ ] Smart Quizes & Flashcards
- [ ] School pages and school wide messaging

### Phase 3: Advanced Social Features 📋
- [ ] School pages and school wide messaging
- [ ] Study groups and peer to peer voice-video calling

See the [open issues](https://github.com/snapflowio/snapflow/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Don't forget to give the project a star! ⭐

### Development Setup

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes and test thoroughly
4. Commit your Changes (`git commit -m 'feat: add some AmazingFeature'`)
5. Push to the Branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

### Contributor Guidelines

- Follow the existing code style and conventions
- Write meaningful commit messages using [Conventional Commits](https://conventionalcommits.org/)
- Add tests for new functionality
- Update documentation as needed
- Be respectful and inclusive in all interactions

### Top Contributors

<a href="https://github.com/snapflowio/snapflow/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=snapflowio/snapflow" alt="contrib.rocks image" />
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the AGPL-3.0 License. See `LICENSE` for more information.

This ensures that any modifications to Snapflow must also be open-source, contributing back to the community.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

**Snapflow Team**
- 📧 Email: hello@snapflow.io
- 💬 Discord: [Join our community](https://discord.gg/8UhNBCV4aU)

**Project Links:**
- 🌐 Website: [snapflow.io](https://snapflow.io)
- 🐛 Issues: [GitHub Issues](https://github.com/snapflowio/snapflow/issues)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

Special thanks to these amazing projects and resources:

**Core Technologies:**
* [NestJS](https://nestjs.com) - A progressive Node.js framework
* [React](https://reactjs.org) - A JavaScript library for building user interfaces
* [TanStack Router](https://tanstack.com/router) - Type-safe router for React
* [Drizzle ORM](https://orm.drizzle.team) - TypeScript ORM for SQL databases
* [Better Auth](https://better-auth.com) - Authentication library for TypeScript

**Development Tools:**
* [Nx](https://nx.dev) - Smart, fast and extensible build system
* [Tailwind CSS](https://tailwindcss.com) - A utility-first CSS framework
* [Radix UI](https://radix-ui.com) - Low-level UI primitives
* [Biome](https://biomejs.dev) - Fast formatter and linter

**Inspiration & Resources:**
* [GitHub's Student Developer Pack](https://education.github.com/pack)
* [Best README Template](https://github.com/othneildrew/Best-README-Template)
* [Shields.io](https://shields.io) - Quality badges for projects
* [Choose an Open Source License](https://choosealicense.com)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Star History

<a href="https://star-history.com/#snapflowio/snapflow&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=snapflowio/snapflow&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=snapflowio/snapflow&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=snapflowio/snapflow&type=Date" />
 </picture>
</a>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/snapflowio/snapflow.svg?style=for-the-badge
[contributors-url]: https://github.com/snapflowio/snapflow/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/snapflowio/snapflow.svg?style=for-the-badge
[forks-url]: https://github.com/snapflowio/snapflow/network/members
[stars-shield]: https://img.shields.io/github/stars/snapflowio/snapflow.svg?style=for-the-badge
[stars-url]: https://github.com/snapflowio/snapflow/stargazers
[issues-shield]: https://img.shields.io/github/issues/snapflowio/snapflow.svg?style=for-the-badge
[issues-url]: https://github.com/snapflowio/snapflow/issues
[license-shield]: https://img.shields.io/github/license/snapflowio/snapflow.svg?style=for-the-badge
[license-url]: https://github.com/snapflowio/snapflow/blob/main/LICENSE
[product-screenshot]: https://raw.githubusercontent.com/snapflowio/.github/refs/heads/main/assets/screenshot.png

<!-- Tech Stack Badges -->
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TypeScript]: https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white
[TypeScript-url]: https://typescriptlang.org/
[NestJS]: https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white
[NestJS-url]: https://nestjs.com/
[Node.js]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[Node-url]: https://nodejs.org/
[PostgreSQL]: https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white
[PostgreSQL-url]: https://postgresql.org/
[Redis]: https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white
[Redis-url]: https://redis.io/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[Vite]: https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white
[Vite-url]: https://vitejs.dev/
[Nx]: https://img.shields.io/badge/Nx-143055?style=for-the-badge&logo=nx&logoColor=white
[Nx-url]: https://nx.dev/
[Docker]: https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white
[Docker-url]: https://docker.com/
[Bun]: https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white
[Bun-url]: https://bun.sh/