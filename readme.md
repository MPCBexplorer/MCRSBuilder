> # Disclaimer: This is not a completed project
>
> If you are looking for a Redstone Simulator, [Redstone Studio](https://redstonestudio.org) and [3D-Redstone-Simulator](https://github.com/GuilhermeRossato/3D-Redstone-Simulator) are recommended. And you can see [why is it here](#why-is-it-here).

[![License](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE)
[![Zig Version](https://img.shields.io/badge/zig-0.16.0-orange.svg)](https://ziglang.org/)
[![Status](https://img.shields.io/badge/status-alpha-yellow.svg)]()

# MCRSBuilder: A 3D Redstone Simulator

So here is how it goes: I wanted to make some cool redstone installations in my server, but it was annoying to build, modify and test them in-game. So I started to search for a simulator. But all that I could find was 2D or 3D ones which, you know, were not exactly what I expected[^1]. Then I decided to make a 3D one, as you can see in this repo.

## Why is it here uncompletely?

I'm sorry if you're looking for a 3D Redstone Simulator. If you are a coder who loves Zig, could you please help me to make it better? I am completely amateur with limited energy. It seems that I can't finish it all by myself. I respectfully hope that the experts in the community will patiently read my poor code and make changes or contributions. I am a learner in Zig so criticism is welcome. Another thing: to prove my Zig skills in practice, I have tried to avoid using AI. So this could really be terrible code.


## 🛠️ Technology Stack

I use Zig for the backend and Three.js for the frontend. And, the WebAssembly compiled from Zig. Why Zig? To tell you the truth, I didn't know Zig well, but I just wanted to learn it. As it is said, the best way to learn a language is to use it. Zig has many features that appeal to me. I once doubted whether this young language supported WebAssembly. Surprisingly it does! — It has drawbacks, though. For example, you have to handle lack of backward compatibility. I use 0.16.0.

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Zig 0.16.0 | Core redstone logic, WebAssembly compilation |
| **Frontend** | Three.js | 3D rendering, user interface, raycasting |
| **Build** | npm + Zig Build System | Project build and development workflow |

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.x
- Zig 0.16.0
- Modern web browser with WebGL support

### Installation

```bash
# Clone the repository
git clone https://github.com/MPCBexplorer/MCRSBuilder.git
cd MCRSBuilder

# Install frontend dependencies
npm install

# Build Zig core to WebAssembly
cd zig-core
zig build -Doptimize=ReleaseSmall
cd ..

# Start development server
npm run dev
```

Open `http://localhost:5173 (see console output)` in your browser.

## 📁 Project Structure (may outdated)

```
MCRSBuilder/
├── zig-core/          # Zig backend 
│   ├── src/           # Core redstone logic
│   └── build.zig      # Build configuration
├── web-frontend/      # TypeScript frontend
│   ├── src/
│   │   ├── core/      # Scene management, rendering
│   │   └── main.ts    # Application entry point
│   └── public/        # Static assets (textures)
├── docs/              # Documentation
└── package.json       # Frontend dependencies
```

## 🤝 Contributing

We welcome contributions! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### Getting Started
1. Check out our [Contributing Guide](/CONTRIBUTING.md)
2. Browse [open issues](../../issues) - look for `good first issue` labels
3. Fork the repo and create a feature branch
4. Submit a pull request

### Need Help
Tasks where we actively seek community support:
- 🆘 Make the backend more Zig-style
- 🆘 Backend tick logic
- 🆘 Frontend refactoring
- 🆘 Redstone expert: redstone logic guidance

## 🗺️ Roadmap to v1.0

- [x] Determine required modules and tech stack
- [x] Complete basic interface

---------0.0.0---------
- [x] Place/clear operations
- [x] Redstone dust texture

---------0.1.0---------
- [ ] Import other components
- [ ] Block updates and signal ticks

---------0.2.0---------
- [ ] Redstone circuits
- [ ] Improved user interface
- [ ] Optimization, refinement, documentation

---------1.0.0!--------
- [ ] Finalize and release the project




## 📝 License

This project is licensed under the GPLv3 License - see the [LICENSE](/LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Minecraft's redstone mechanics
- Built with [Three.js](https://threejs.org/) for 3D rendering
- Powered by [Zig](https://ziglang.org/) for high-performance WASM compilation
- Thanks to all contributors who help make this project better

[^1]: I'm not saying they're bad; on the contrary, I admire them for writing such cool projects.
