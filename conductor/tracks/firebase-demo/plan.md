# Implementation Plan: Firebase Hosting Demo

## Overview
We will add the necessary Firebase configuration file to the root of the project to allow deploying the `demo` directory directly to Firebase Hosting. 

## Steps

- [x] **Step 1: Create `firebase.json`**
  - Add a `firebase.json` file in the project root.
  - Configure the `hosting` block with `"public": "demo"`.
  - Add standard ignores (`node_modules`, etc.).
  
- [x] **Step 2: User Validation & Deployment Instruction**
  - Ask the user to provide their existing Firebase project ID, or instruct them to run `firebase init hosting` or `firebase deploy` manually.
  - (Optional) Create a `.firebaserc` if a project ID is provided.

- [x] **Step 3: Update `README.md` (Optional)**
  - Add a short section to the README explaining how to view or deploy the demo.