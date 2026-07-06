# Forklift

Forklift is a TypeScript framework for developing, testing, and scripting Move smart contracts on Movement. It provides a unified interface — the `Harness` class — that works across local simulation, Movement network forking, and live Movement network execution.

## Features

- **Local Simulation**: Develop and test without any network. Runs entirely in memory with instant execution. Includes test-only APIs like instant account funding.
- **Network Forking**: Test against real Movement Mainnet/Testnet/Devnet state without spending gas or affecting the network.
- **Live Scripting**: Deploy contracts and execute transactions on real networks using the same code you tested locally.
- **TypeScript Native**: Write tests and scripts in standard TypeScript with full Node.js capabilities.
- **Easy Setup**: No need to manually spawn or manage a local validator node. Forklift handles the simulation lifecycle automatically.
- **Isolation & Repeatability**: Each session runs in isolation with deterministic results — perfect for automated testing/CI.

## Installation

```bash
npm install @aptos-labs/forklift
```

**Prerequisites:** Node.js v18+ and Movement CLI. Local simulation and network forking require v8.1.0+ with transaction simulation session support; live mode only requires a CLI that supports the live command being executed. Forklift invokes `movement` by default; set `FORKLIFT_CLI_BINARY=/path/to/movement` to use a specific CLI build.

## Quick Start

```typescript
import { Harness } from "@aptos-labs/forklift";

const harness = Harness.createLocal();

harness.initCliProfile("alice");
harness.fundAccount("alice", 100_000_000);

const result = harness.deployCodeObject({
  sender: "alice",
  packageDir: "./move/my_contract",
  packageAddressName: "my_contract",
});

harness.cleanup();
```

## Documentation

For full documentation, API reference, and examples, see the [GitHub repository](https://github.com/MoveIndustries/forklift).

## License

Apache-2.0
