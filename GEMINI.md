# Project Instructions (GEMINI.md)

This file contains foundational mandates for all agents and developers working on the **Web Sonifier** project.

## Core Mandates

1.  **Test-Driven Development**: The project relies on a robust unit test suite located in `packages/core/test/`. All new features or fixes must include corresponding tests.
2.  **Pre-commit Hook**: A Git hook is configured via `husky` to automatically run `npm test` before every commit. You **must not** bypass this hook (e.g., using `--no-verify`) unless explicitly instructed by the user.
3.  **Monorepo Structure**: This project uses `npm` workspaces. Ensure dependencies are managed at the root or correctly within individual packages.
4.  **Browser Compatibility**: The core and plugin packages must remain compatible with vanilla browser environments. Avoid adding Node-specific dependencies to these packages.

## Workspace Guidelines
-   Use Conductor tracks for all non-trivial features and refactors.
-   Maintain the `conductor/` directory as the single source of truth for planning.
