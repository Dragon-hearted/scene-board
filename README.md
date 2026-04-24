<div align="center">

![SceneBoard](images/hero.svg)

### CLI-driven storyboard creation system that transforms video briefs of any format into professional storyboards with scripts, timestamps, voice scripts, and NanoBanana Pro prompts for visual generation — leveraging marketing, sales, social media, and ads skills

![Status](https://img.shields.io/badge/Status-active-brightgreen)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-Runtime-f9f1e1?logo=bun&logoColor=000)](https://bun.sh/)

</div>

---

## 📑 Table of Contents

- [✨ Features](#features)
- [🏗 Architecture](#architecture)
- [🛠 Tech Stack](#tech-stack)
- [🚀 Getting Started](#getting-started)
- [💻 Development](#development)
- [📂 Project Structure](#project-structure)
- [🤝 Contributing](#contributing)
- [📄 License](#license)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **storyboard-creation** | Core task type |
| **script-generation** | Core task type |
| **visual-prompt-generation** | Core task type |
| **video-pre-production** | Core task type |
| **client-management** | Core task type |
| **pdf-generation** | Core task type |
| **video-brief Input** | Supported input type |
| **script Input** | Supported input type |
| **reference-video-link Input** | Supported input type |
| **voice-script Input** | Supported input type |
| **raw-idea Input** | Supported input type |
| **brand-document Input** | Supported input type |
| **brand-guidelines Input** | Supported input type |
| **storyboard-document Output** | Supported output type |
| **nanobanana-pro-prompts Output** | Supported output type |
| **scene-breakdown Output** | Supported output type |
| **pdf-storyboard Output** | Supported output type |
| **client-brand-profile Output** | Supported output type |

---

## 🏗 Architecture

![Pipeline](images/pipeline.svg)

SceneBoard processes data through a multi-stage pipeline.

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **TypeScript 5.7** | Type safety |
| **Bun** | JavaScript runtime & package manager |

---

## 🚀 Getting Started

### Prerequisites

- [**Bun**](https://bun.sh/) v1.0+ — `curl -fsSL https://bun.sh/install | bash`

### Install

```bash
cd systems/scene-board
bun install
```

### Run

```bash
bun run systems/scene-board/src/index.ts
```

---

## 💻 Development

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development mode |
| `bun run build` | Build for production |
| `bun test` | Run tests |
| `bun run lint` | Check code quality |

---

## 📂 Project Structure

```
scene-board/
├── README.md
├── biome.json
├── clients
│   ├── README.md
│   └── vindof
│       └── brand.md
├── images
│   ├── hero.svg
│   └── pipeline.svg
├── justfile
├── knowledge
│   ├── acceptance-criteria.md
│   ├── dependencies.md
│   ├── domain.md
│   ├── history.md
│   ├── index.md
│   ├── nanobanana-pro-prompt-guide.md
│   └── scope.md
├── package.json
├── scripts
│   └── generate-pdf.sh
├── src
│   ├── batch-generator.ts
│   ├── character-sheet-generator.ts
│   ├── image-client.ts
│   ├── index.ts
│   ├── storyboard-assembler.ts
│   └── types
│       └── character.ts
├── templates
│   ├── pdf-storyboard-template.md
│   ├── pdf-styles.css
│   └── storyboard-template.md
├── tsconfig.json
└── vendor
    └── design-system
        └── tokens.css
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and ensure tests pass
4. Commit your changes and open a pull request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with** 🧡 **using Bun, TypeScript**

</div>
