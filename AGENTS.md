# Forklift - Agent Guide

This document helps AI agents work effectively with the Forklift codebase. For user-facing documentation (what Forklift is, API reference, usage), see [README.md](./README.md).

## Architecture & Design Choices

Forklift is intentionally **lightweight**. It's a thin TypeScript wrapper around the Aptos CLI's Transaction Simulation Sessions feature. The CLI does the heavy lifting (compilation, simulation, transaction building); Forklift provides a clean programmatic interface.

This design has key benefits:
- **Easy to maintain** — minimal surface area, few moving parts
- **Fast to iterate** — changes are localized, easy to test
- **High test coverage** — simple code is practical to cover thoroughly
- **Stays in sync** — leveraging the CLI means we inherit improvements automatically
- **Portable** — the thin design makes it feasible to port to other languages (Python, Go)
- **AI-friendly** — structured boilerplate with clear logic separation makes this codebase easy for AI to understand and evolve

Forklift was largely built using AI agents. The design choices above weren't accidental — they make the codebase maintainable both by humans and AI. Documentation serves a dual purpose: clarifying design for human engineers and providing permanent context for AI. Tests act as precise specs that AI can verify against.

## Repository Structure

```
forklift/
├── packages/
│   ├── forklift/          # Core library (@aptos-labs/forklift)
│   ├── testsuite/         # Internal tests (Jest, local simulation)
│   ├── live-tests/        # Tests against a real local node
│   └── example-tip-jar/   # Tutorial example with full workflow
├── scripts/               # Repository-wide scripts
└── .github/workflows/     # CI configuration
```

### Package Details

**`packages/forklift/`** - The core library
- `src/harness.ts` - The `Harness` class (~1200 lines). Nearly all Forklift functionality lives here.
- `src/index.ts` - Public API exports
- `src/util.ts` - Utility functions (assertions, etc.)

**`packages/testsuite/`** - Main test suite
- Each file in `src/tests/` tests a specific feature
- Run with `npm test` (requires forklift to be built first)

**`packages/live-tests/`** - Live node tests
- Requires a running local Aptos node
- More complex setup; prefer testsuite for most testing

**`packages/example-tip-jar/`** - Tutorial example
- `move/tip_jar/` - Move contract
- `src/workflows.ts` - Reusable workflow functions
- `src/scripts/` - CLI scripts for network interaction
- `src/tests/` - Integration tests
- Has its own README serving as a user tutorial

## Development Workflows

### Building and Testing

```bash
# Build forklift first (other packages depend on it)
cd packages/forklift && npm ci && npm run build

# Run testsuite
cd packages/testsuite && npm ci && npm test

# Run specific test
npm test -- deploy_object

# Format all packages
./scripts/format.sh
```

### Adding a New Harness Method

1. Add the method to `packages/forklift/src/harness.ts`
2. Add a test in `packages/testsuite/src/tests/`
3. Update `packages/live-tests/` if the feature needs live network testing
4. Update `README.md` API Reference section

### Adding a Test

Create a new `.ts` file in `packages/testsuite/src/tests/`:

```typescript
import { Harness } from "@aptos-labs/forklift";

describe("Feature Name", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = Harness.createLocal();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("does something", () => {
    // test code
  });
});
```

## Harness Internals

### Proxy/Poisoning Pattern

The `Harness` constructor returns a Proxy, not the raw instance. This intercepts all method calls and checks if the harness has been "poisoned" (i.e., `cleanup()` was called). If poisoned, any method call throws an error. This prevents accidental use of a harness after its temp directory has been deleted.

### Error Handling

Transaction methods (like `runMoveFunction`, `deployCodeObject`) follow this pattern:

- **Transaction executes** → Returns a result object. Check `result.Result.success` for success/failure. Failed transactions (Move aborts, out of gas, etc.) return with failure info in the result.
- **CLI/infrastructure failure** → Throws an error (CLI not found, compilation error, process crash, invalid JSON output)

So: check `result.Result.success` for transaction outcomes, use try/catch for infrastructure failures.

### When to Use Each Test Mode

| Mode | Use When |
|------|----------|
| **Local** (`createLocal`) | Default choice. Fast, isolated, deterministic. Use for unit tests, CI, and most development. |
| **Fork** (`createNetworkFork`) | Testing against real deployed contracts or production state. Verifying scripts before live execution. |
| **Live** (`createLive`) | Actually deploying or executing on a real network. Use sparingly — costs gas, changes are permanent. |

Rule of thumb: Start with local. Only use fork when you need real chain state. Only use live when you're ready to execute for real.

### Code Organization

The harness uses interface inheritance and helper functions to reduce duplication:

- **Base interfaces** (`TransactionOptions`, `FunctionCallOptions`, `PackageOptions`) capture common fields. Method-specific interfaces extend these.
- **Helper functions** (`addTransactionOptions`, `addNamedAddresses`, etc.) build CLI arguments from options objects.
- **`runAptos(args)`** private method wraps all CLI calls with the working directory.

When adding new harness methods, look for existing interfaces and helpers to reuse. Check the top of `harness.ts` for current interfaces and helpers.

## Code Conventions

- **Always call `harness.cleanup()`** in `afterEach` or `finally` blocks
- **Prefer `throw new Error()`** over `process.exit(1)` in library code
- **Named CLI arguments** over positional (using `minimist` in scripts)
- **Prettier** for formatting (`npm run format` in each package)

## CI Workflows

| Workflow | Purpose |
|----------|---------|
| `run-tests.yml` | Runs testsuite on PRs |
| `run-live-tests.yml` | Runs live-tests (requires local node) |
| `check-formatting.yml` | Verifies code formatting |
| `check-lockfiles.yml` | Ensures lockfiles are up to date |

## Common Pitfalls

1. **Forgetting cleanup()** - Harness creates temp directories. Always clean up.

2. **Address normalization** - Addresses may vary in format (`0x1` vs `0x0000...0001`). Normalize when comparing.

3. **Build order** - Must build `packages/forklift` before running tests in other packages.

4. **Move.toml placeholders** - Use `"_"` for addresses set during deployment:
   ```toml
   [addresses]
   my_contract = "_"
   ```

## Debugging Tips

- `harness.getWorkingDir()` returns the temp directory path
- Transaction results have `success` boolean and error info
- Use `includeEvents: true` to get events in results
