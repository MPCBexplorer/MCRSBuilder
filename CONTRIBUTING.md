# Contributing to MCRSBuilder

Thank you for your interest in contributing to MCRSBuilder! This guide will help you get started.
> AI is allowed in the whole project. As long as you have reviewed what AI has
> done and noted down where AI has been used.
## Coding Standards
- Always write comments for what you add or modify.
- Note down where AI has been used.
- Refer to the actual game logic of Minecraft.
- As for the assets, look for it in the jar of MC1.20.1+
- Use `snake_case` for functions and variables
- No extra dependencies without an approved issue.
- Test before submitting a PR.

### For each language
#### Zig
- v0.16.0, only this version
- Zig-style
- Keep functions small and focused
- Deal with all errors gracefully, rather than ‘unreachable’ for all
#### TypeScript
- Use strict mode
- Prefer interfaces over type aliases for object shapes
## How Can I Contribute?

### Reporting Bugs
Before creating bug reports, please check [existing issues](https://github.com/MPCBexplorer/MCRSBuilder/issues) to avoid duplicates.Just follow the template.


### Code Contributions

#### Finding Your First Task
-  **Good First Issues**: Perfect for newcomers. Well-defined tasks that don't require deep codebase knowledge.
-  **Help Wanted**: Tasks where we actively need community support.

Browse all labeled issues on our [Issues page](https://github.com/MPCBexplorer/MCRSBuilder/issues).

#### Development Workflow

1. **Fork the repository**
   Click the "Fork" button on the GitHub page of the repository. 
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MCRSBuilder.git
   cd MCRSBuilder
   
   # Add upstream remote to sync with original repository
   git remote add upstream https://github.com/MPCBexplorer/MCRSBuilder.git
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
   - Ensure using Zig v0.16.0
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

5. **Test your changes**
   ```bash
   # Test WASM build
   cd zig-core && zig build test
   
   # Run frontend
   npm run dev
   ```

6. **Commit your changes**
   ```bash
   git commit -m "feat: add redstone comparator basic logic"
   ```
   
   **Commit message format:**
   - `feat(xxx):` New feature
   - `fix(xxx):` Bug fix
   - `docs(xxx):` Documentation changes
   - `refactor(xxx):` Code refactoring 
   - `style(xxx):` Code style changes (no functional changes)
   - `test(xxx):` Adding/updating tests

7. **Push and create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then open a PR on GitHub with:
   - Clear description of changes
   - Link to related issue
   - Screenshots for UI changes

## Codebase Overview

### Architecture
```
User Input → Frontend (TypeScript/Three.js) → WASM (Zig) → State Update → Rendering
```

### Key Areas for Contribution

#### Zig Core (`zig-core/src/`)
- Redstone signal propagation logic
- Block state management
- WASM export functions

**Good for**: Developers interested in Zig and Minecraft


#### Frontend Rendering (`web-frontend/src/core/scene.ts`)
- Three.js scene management
- Mesh instancing for performance
- Raycasting for block interaction

**Good for**: Graphics programmers, Three.js enthusiasts


#### User Interface (`web-frontend/src/main.ts`)
- Event handling
- Mode switching (Build/Info/Move)
- Block selection UI

**Good for**: Frontend developers



## Communication

- **GitHub Issues**: For bug reports and feature requests
- **Pull Requests**: For code discussions
- **Discussions tab**: For general questions and ideas (coming soon)

## Questions?

Don't hesitate to ask! Create an issue with the label `question` or mention "@maintainer" in your PR.

## Thank You

Every contribution, no matter how small, helps make MCRSBuilder better. We appreciate your time and effort!

---

*Happy coding! 🚀*