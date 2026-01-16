# ADR 001: AI Service as a Stateless Compute Unit

## Status
Accepted

## Context
The application requires heavy AI processing (depth map generation, Gaussian Splatting) to be performed on user photos. We needed to decide how to structure the relationship between the main application logic and the AI processing capabilities, especially considering the constraints of running a local VR application with potential resource contention.

## Decision
We define the AI Service as a **"Dumb", Stateless Compute Unit**. 

*   **Role**: It is strictly a calculation engine ("The Muscle").
*   **Non-Role**: It DOES NOT handle business logic, authentication, user data persistence, or decision-making. 
*   **Communication**: It communicates ONLY with the Backend service. It is not exposed to the public internet or the Frontend directly.
*   **State**: It should be treated as ephemeral. While it may cache models for performance, it should not be the system of record for any data.

## Consequences
*   **Simplification**: The AI service code remains focused purely on PyTorch/Machine Learning logic without being cluttered by API auth or complex state management.
*   **Security**: The AI service is isolated from external traffic.
*   **Dependency**: The Backend becomes the single point of failure and orchestration ("The Brain"). The AI service cannot function meaningfully without the Backend telling it what to do.
