# Specification: Firebase Hosting Demo

## Objective
Configure Firebase Hosting to serve the `demo/` directory of the `web-sonify` repository so the sonifier can be demonstrated live on the web.

## Requirements
1. The project must have a valid `firebase.json` configuration file at its root.
2. The `firebase.json` must map the hosting `public` directory to the existing `demo/` folder.
3. The demo site must be accessible without any build steps (since the demo currently relies on vanilla JS and raw imports).

## Out of Scope
- Setting up a build pipeline (e.g., Webpack/Vite) for the demo.
- Altering the source code of the demo to use bundlers; we are just statically hosting the raw files.
- Automated CI/CD deployment via GitHub Actions (can be a separate track later).