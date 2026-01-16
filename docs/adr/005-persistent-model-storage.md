# ADR 005: Persistent Model Storage

## Status
Accepted

## Context
In the initial implementation, the AI service container did not have a persistent volume mapped to its model cache directory (`/root/.cache/huggingface`). Resulting in all downloaded gigabytes of model data being lost whenever the container was recreated or restarted. This contradicts the user's requirement for a robust, backup-friendly system.

## Decision
We mandate **Persistent Storage for all AI Models**.

1.  **Host Mapping**: The AI service must map a volume from the host's `./data` directory (or similar persistent location) to the internal model cache directory.
2.  **Backup Friendly**: The directory structure on the host must be clean and exposed in a way that allows the user to easily back up their "state" (photos + models + database) by simply copying the `data/` folder.
3.  **Single Source of Files**: We should strictly avoid storing models inside the container's ephemeral file system.

## Consequences
*   **DevOps Update**: The `docker-compose.yml` must be updated to include this volume mapping.
*   **Storage Management**: The user's disk usage in the `data/` folder will grow significantly (GBs). We must provide UI/Tools to clear this cache if needed.
