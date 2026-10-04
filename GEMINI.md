# Project Instructions (GEMINI.md)

This file contains foundational mandates for all agents and developers working on the **Web Sonifier** project.

## Core Mandates

1.  **Test-Driven Development**: The project relies on a robust unit test suite located in `packages/core/test/`. All new features or fixes must include corresponding tests.
2.  **Pre-commit Hook**: A Git hook is configured via `husky` to automatically run `npm test` before every commit. You **must not** bypass this hook (e.g., using `--no-verify`) unless explicitly instructed by the user.
3.  **Monorepo Structure**: This project uses `npm` workspaces. Ensure dependencies are managed at the root or correctly within individual packages.
4.  **Browser Compatibility**: The core and plugin packages must remain compatible with vanilla browser environments. Avoid adding Node-specific dependencies to these packages.

## Workspace Guidelines
-   Use Antigravity planning mode for all non-trivial features and refactors.
-   **No Direct Push to Main**: NEVER push directly to `main` or merge locally into `main` before pushing.
-   **Issue-Driven Worktree & PR Lifecycle Workflow**:
    Whenever work on a new issue is started, all agents and developers MUST execute the following lifecycle:
    1. **Branch & Worktree Provisioning**:
       - Ensure `main` is fresh: `git checkout main && git pull origin main`.
       - Create a new branch named after the issue (e.g., `feat/<issue-number>-<slug>` or `fix/<issue-number>-<slug>`).
       - Create a dedicated worktree inside `.worktrees/<branch-name>`:
         ```bash
         git worktree add .worktrees/<branch-name> -b <branch-name> origin/main
         ln -s ../../node_modules .worktrees/<branch-name>/node_modules
         ```
       - **All development, editing, building, and testing for this issue MUST occur inside this worktree directory.**
    2. **Draft Pull Request Creation**:
       - Push the initial branch/commit to origin:
         ```bash
         git push -u origin <branch-name>
         ```
       - Create a Draft Pull Request immediately on GitHub:
         ```bash
         gh pr create --draft --title "WIP: #<issue> <short-description>" --body "Closes #<issue>\n\nWork in progress on dedicated worktree..."
         ```
       - The draft PR enables real-time tracking of branch drift from `main`, triggers preliminary CI checks, and provides full progress visibility.
    3. **Drift Tracking & Synchronization**:
       - While working in the worktree, periodically track how far the branch drifts from `main`.
       - Fetch and rebase/merge regularly to keep the branch clean and up to date:
         ```bash
         git fetch origin main
         git rebase origin/main # or git merge origin/main
         ```
       - Resolve any conflicts early to ensure trivial, clean integration later.
    4. **Completion & PR Finalization**:
       - When all work and tests for the issue are complete inside the worktree:
         - Verify all unit tests pass locally (`npm test` runs automatically via husky pre-commit hook).
         - Push all final commits to `origin`.
         - Update the PR description with the final summary of changes, motivation, and verification checklist.
         - Mark the PR ready for review: `gh pr ready <PR-number>`.
         - Verify there are zero merge conflicts and that the PR will merge cleanly into `main` (`gh pr view`).
         - Verify that all CI status checks (e.g., `test.yml`) are 100% green.
    5. **User Review & Merge Protocol**:
       - **The USER reviews the PR and executes the merge.**
       - The agent ensures:
         - Zero merge conflicts with `main`.
         - Clean mergeability.
         - All unit tests and CI checks are passing.
       - Notify the user that the PR is ready for their final review and merge.
    6. **Post-Merge Cleanup & Sync**:
       - After the user merges the PR on GitHub:
         - Switch back to the root repository and pull latest `main`:
           ```bash
           git checkout main && git pull origin main
           ```
         - Remove the worktree:
           ```bash
           git worktree remove .worktrees/<branch-name>
           ```
         - Delete the local and remote branch:
           ```bash
           git branch -d <branch-name>
           git push origin --delete <branch-name>
           ```
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
