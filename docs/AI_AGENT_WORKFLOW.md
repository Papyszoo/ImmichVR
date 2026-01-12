# AI Agent Workflow Instructions

This document outlines the standard operating procedure for the AI agent when processing "continue with next roadmap task" requests.

## 1. Roadmap Management
- **Identify Task**: Read `roadmap.md` to find the next priority task (first unchecked item).
- **Execute**: Implement the changes required by the task.
- **Update Status**: Remove the completed task from `roadmap.md` once finished (keep the file clean).

## 2. Testing Protocol
After completing code changes, you **MUST** verify the application functionality:

### Step 1: Start Application
Run the following command in the project root (`d:\github\ImmichVR`):
```powershell
docker-compose up -d --build
```

### Step 2: Verify Access
- Open `https://localhost:21370` to ensure the application loads.
- Check container logs if there are issues: `docker-compose logs -f`

### Step 3: VR Interaction Testing (If Applicable)
If the task involves VR features, you **MUST** test VR interactions:
- **Reference**: Follow the instructions in [VR_EMULATOR.md](./VR_EMULATOR.md).
- **Key Tests**:
    - Entering VR mode.
    - Scrolling the gallery (Right Controller Thumbstick Y-axis).
    - Photo selection and navigation.

## 3. Cleanup
- Remove any temporary files created.
- Ensure the codebase is clean before finishing.
