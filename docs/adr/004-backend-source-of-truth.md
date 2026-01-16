# ADR 004: Backend as Source of Truth

## Status
Accepted

## Context
We have a split architecture with a Node.js Backend and a Python AI Service. Both services need to know about the state of AI models (Which ones are downloaded? Which one is active?). Managing distributed state can lead to desynchronization bugs (e.g., "Zombie models").

## Decision
The **Backend Service** is designated as the Single Source of Truth for the application state.

1.  **AI Service Passivity**: The AI service reports its *capabilities* (what files it sees, what is in memory) but does not make business decisions.
2.  **Orchestration**: The Backend instructs the AI service to download, load, or unload models.
3.  **Database Authority**: The Backend's database records (e.g., in `ai_models` table) are the master record. If the database says a model is "downloaded" but the file is missing on the AI disk, the system must reconcile this (usually by re-downloading), but the *intent* is driven by the Backend's data.

## Consequences
*   **State Alignment**: Reduces "split-brain" scenarios where Frontend thinks one thing and AI thinks another.
*   **Logic Centralization**: Business logic resides in Node.js, keeping the Python service simple.
