# Forklift

Forklift is a TypeScript framework for developing, testing, and scripting Aptos Move smart contracts. It provides a unified interface — the `Harness` class — that works across local simulation, network forking, and live network execution.

## Features

- **Local Simulation**: Develop and test without any network. Runs entirely in memory with instant execution. Includes test-only APIs like instant account funding.
- **Network Forking**: Test against real Mainnet/Testnet/Devnet state without spending gas or affecting the network.
- **Live Scripting**: Deploy contracts and execute transactions on real networks using the same code you tested locally.
- **TypeScript Native**: Write tests and scripts in standard TypeScript with full Node.js capabilities.
- **Easy Setup**: No need to manually spawn or manage a local validator node. Forklift handles the simulation lifecycle automatically.
- **Isolation & Repeatability**: Each session runs in isolation with deterministic results — perfect for automated testing/CI.

## Installation

```bash
npm install @aptos-labs/forklift
```

**Prerequisites:** Node.js v18+ and [Aptos CLI](https://aptos.dev/tools/aptos-cli/) v7.14.2+

## Quick Start

```typescript
import { Harness } from "@aptos-labs/forklift";

const harness = Harness.createLocal();

harness.init_cli_profile("alice");
harness.fundAccount("alice", 100_000_000);

const result = harness.deployCodeObject({
  sender: "alice",
  packageDir: "./move/my_contract",
  packageAddressName: "my_contract",
});

harness.cleanup();
```

## Documentation

For full documentation, API reference, and examples, see the [GitHub repository](https://github.com/aptos-labs/forklift).

## License

Apache-2.0
