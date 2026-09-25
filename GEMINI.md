# Project Instructions (GEMINI.md)

This file contains foundational mandates for all agents and developers working on the **Web Sonifier** project.

## Core Mandates

1.  **Test-Driven Development**: The project relies on a robust unit test suite located in `packages/core/test/`. All new features or fixes must include corresponding tests.
2.  **Pre-commit Hook**: A Git hook is configured via `husky` to automatically run `npm test` before every commit. You **must not** bypass this hook (e.g., using `--no-verify`) unless explicitly instructed by the user.
3.  **Monorepo Structure**: This project uses `npm` workspaces. Ensure dependencies are managed at the root or correctly within individual packages.
4.  **Browser Compatibility**: The core and plugin packages must remain compatible with vanilla browser environments. Avoid adding Node-specific dependencies to these packages.

## Workspace Guidelines
-   Use Antigravity planning mode for all non-trivial features and refactors.
-   **Track Lifecycle & Pull Request Mandate**: 
    -   **No Direct Push to Main**: NEVER push directly to `main` or merge locally into `main` before pushing.
    -   **Branching**: Always create a new feature (`feat/...`) or bugfix (`fix/...`) branch when starting a task or track.
    -   **Pull Request Workflow**:
        1. Commit changes to the feature/bugfix branch (pre-commit tests run via husky).
        2. Push the branch to `origin` (`git push -u origin <branch>`).
        3. Create a Pull Request (via `gh pr create`).
        4. Verify CI status checks (`test.yml`) pass on the PR.
        5. Merge the PR into `main` (via `gh pr merge`). Merging into `main` on GitHub triggers the automated deployment pipeline (`deploy.yml`).
    -   **Sync & Cleanup**: Pull the latest `main` locally (`git checkout main && git pull origin main`) and delete the feature branch locally and remotely (`git branch -d <branch>`).
-   Maintain `implementation_plan.md` and `task.md` in the App Data Directory as the source of truth for tracking active tasks.

## Sonifier Best Practices

1.  **Parameter Smoothing**: To avoid "zipper noise" or clicks when parameters change abruptly, sonifiers should use Web Audio's automation methods (e.g., `setTargetAtTime` or `linearRampToValueAtTime`).
    -   **Temporal Integrity**: Keep ramp times short (e.g., 10-50ms) to ensure the sound remains responsive to critical data spikes. 
    -   **Data vs. Audio**: The `Adapter` handles data mapping; the `Sonifier` handles audio-rate transitions. Do not implement time-based smoothing in the `Adapter` as data arrival rates are unpredictable.

2.  **Teardown Integrity**: Always ramp the sonifier's output gain to zero before stopping sources or disconnecting the graph in `destroy()`. Sudden disconnections cause audible "pops" or "clicks".

## Local Model Delegation & Task Parallelization

1.  **Local Ollama Delegation (`deepseek-r1:32b`, `qwen3-coder:30b`)**:
    - When planning non-trivial features, the Coordinator agent should proactively look for opportunities to delegate tasks to the local model via the `local-llm` skill (`~/.gemini/config/plugins/local-ollama-assistant/skills/local-llm/scripts/query_ollama.py`).
    - **Best Tasks for Local Delegation**:
      - Adversarial fuzz test generation & boundary audits.
      - Boilerplate unit test fixtures and mock generation.
      - Mathematical derivations & DSP physics formulation review.
      - JSDoc / API documentation generation.
    - **Quota Savings**: Running these locally on the Mac M-series GPU preserves cloud quota for high-level architectural reasoning and coordination.
