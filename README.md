# Forklift

[![Tests](https://github.com/aptos-labs/forklift/actions/workflows/run-tests.yml/badge.svg)](https://github.com/aptos-labs/forklift/actions/workflows/run-tests.yml)
[![Live Tests](https://github.com/aptos-labs/forklift/actions/workflows/run-live-tests.yml/badge.svg)](https://github.com/aptos-labs/forklift/actions/workflows/run-live-tests.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Forklift is a TypeScript framework for developing, testing, and scripting Aptos Move smart contracts. It provides a unified interface — the `Harness` class — that works across local simulation, network forking, and live network execution.

## Features

- **Local Simulation**: Develop and test without any network. Runs entirely in memory with instant execution. Includes test-only APIs like instant account funding.
- **Network Forking**: Test against real Mainnet/Testnet/Devnet state without spending gas or affecting the network.
- **Live Scripting**: Deploy contracts and execute transactions on real networks using the same code you tested locally.
- **TypeScript Native**: Write tests and scripts in standard TypeScript with full Node.js capabilities.
- **Easy Setup**: No need to manually spawn or manage a local validator node. Forklift handles the simulation lifecycle automatically.
- **Isolation & Repeatability**: Each session runs in isolation with deterministic results — perfect for automated testing/CI.

## Prerequisites

- **Node.js** v18 or later
- **Aptos CLI** v7.14.1 or later ([installation guide](https://aptos.dev/tools/aptos-cli/))

## Installation

```bash
npm install --save-dev @aptos-labs/forklift
```

## Quick Start

```typescript
import { Harness } from "@aptos-labs/forklift";

// Create a local harness for testing
const harness = Harness.createLocal();

// Set up an account
harness.init_cli_profile("alice");
harness.fundAccount("alice", 100_000_000);

// Deploy a contract
const result = harness.deployCodeObject({
  sender: "alice",
  packageDir: "./move/my_contract",
  packageAddressName: "my_contract",
});

// Call a function
harness.runMoveFunction({
  sender: "alice",
  functionId: `${result.Result.deployed_object_address}::my_module::my_function`,
  args: ["u64:42"],
});

// Clean up when done
harness.cleanup();
```

For a complete tutorial, see the [TipJar example](./packages/example-tip-jar/).

> **Note:** Forklift uses the same formats as the Aptos CLI for function IDs (`0x1::module::function`), addresses, and typed arguments (`u64:100`, `address:0x1`, `bool:true`). If you're familiar with the CLI, you already know the syntax.

## The Harness Class

All interactions with Forklift go through the `Harness` class. Create one using the appropriate factory method for your use case:

| Factory Method | Mode | Use For |
|---------------|------|---------|
| `Harness.createLocal()` | Local simulation | Development, unit/integration tests, CI |
| `Harness.createNetworkFork(network, apiKey)` | Network forking | Testing against real state, dry-runs |
| `Harness.createLive(network)` | Live execution | Deploying and interacting with contracts for real |

**Local simulation** is your starting point. It runs entirely in memory with no network dependencies — perfect for rapid iteration during development and for CI pipelines.

**Network forking** is one of Forklift's most powerful features. It fetches real chain state (accounts, resources, deployed contracts) and lets you simulate against it locally. This is useful for testing interactions with existing protocols or verifying your scripts before executing them for real. The `apiKey` is required to avoid rate limiting when fetching state from the network — [get one for free](https://aptos.dev/build/guides/build-e2e-dapp#setup-api-key).

**Live mode** executes real transactions on the network. Use this when you're ready to deploy or interact with contracts for real — but remember, this costs gas and changes are permanent.

The key insight: **your code stays the same across all modes**. Write workflow functions that take a `Harness` parameter, then swap the harness to change modes.

## API Reference

### Creating a Harness

| Method | Description |
|--------|-------------|
| `Harness.createLocal()` | Create a harness for local simulation |
| `Harness.createNetworkFork(network, apiKey, version?)` | Create a harness that forks a real network's state |
| `Harness.createLive(network, faucetUrl?)` | Create a harness for live network interaction |

### Account Management

| Method | Description |
|--------|-------------|
| `init_cli_profile(name, privateKey?)` | Initialize an account profile. Generates a random key if not provided. Does not create anything on-chain yet. |
| `fundAccount(account, amount)` | Fund an account with APT (in octas). Only works in live mode if a valid faucet is provided. |
| `getAccountAddress(profile)` | Get the address for a profile name. |

### Executing Transactions

**`runMoveFunction(options)`** — Call an entry function.

```typescript
harness.runMoveFunction({
  sender: "alice",
  functionId: "0x1::coin::transfer",
  args: ["address:0x2", "u64:1000"],
  typeArgs: ["0x1::aptos_coin::AptosCoin"],
});
```

| Option | Required | Description |
|--------|----------|-------------|
| `sender` | Yes | Profile name or address of the transaction sender |
| `functionId` | Yes | Fully qualified function ID (e.g., `0x1::module::function`) |
| `args` | No | Typed arguments (e.g., `["u64:100", "address:0x1"]`) |
| `typeArgs` | No | Type arguments for generic functions |
| `gasUnitPrice` | No | Gas unit price |
| `maxGas` | No | Maximum gas units |
| `expirationSecs` | No | Transaction expiration in seconds |
| `includeEvents` | No | If true, includes events in the result |
| `extraFlags` | No | Additional flags passed to the CLI command |

**`runMoveScript(options)`** — Compile and run a Move script.

| Option | Required | Description |
|--------|----------|-------------|
| `sender` | Yes | Profile name or address of the transaction sender |
| `packageDir` | Yes | Path to the Move package containing the script |
| `scriptName` | Yes | Name of the script function to run |
| `args` | No | Typed arguments |
| `typeArgs` | No | Type arguments |
| `namedAddresses` | No | Named address mappings (e.g., `{ "my_addr": "0x1" }`) |
| `gasUnitPrice` | No | Gas unit price |
| `maxGas` | No | Maximum gas units |
| `expirationSecs` | No | Transaction expiration in seconds |
| `includeEvents` | No | If true, includes events in the result |
| `compileExtraFlags` | No | Additional flags passed to the compile command |
| `runExtraFlags` | No | Additional flags passed to the run command |

### Deploying Code

**`deployCodeObject(options)`** — Deploy a package as a code object. Returns the deployed object address in `result.Result.deployed_object_address`.

```typescript
const result = harness.deployCodeObject({
  sender: "alice",
  packageDir: "./move/my_contract",
  packageAddressName: "my_contract",
});
```

| Option | Required | Description |
|--------|----------|-------------|
| `sender` | Yes | Profile name or address of the deployer |
| `packageDir` | Yes | Path to the Move package |
| `packageAddressName` | Yes | The named address in Move.toml (e.g., `my_contract = "_"`) that represents the package's address. During deployment, a new object is created and this named address is set to the object's address. |
| `namedAddresses` | No | Additional named address mappings |
| `includedArtifacts` | No | If true, includes artifacts in the package |
| `chunked` | No | If true, uses chunked upload for large packages |
| `gasUnitPrice` | No | Gas unit price |
| `maxGas` | No | Maximum gas units |
| `expirationSecs` | No | Transaction expiration in seconds |
| `includeEvents` | No | If true, includes events in the result |
| `extraFlags` | No | Additional flags passed to the CLI command |

**`upgradeCodeObject(options)`** — Upgrade an existing code object.

| Option | Required | Description |
|--------|----------|-------------|
| `sender` | Yes | Profile name or address (must be upgrade authority) |
| `packageDir` | Yes | Path to the Move package |
| `packageAddressName` | Yes | The named address in Move.toml that represents the package's address (same as used in initial deployment) |
| `objectAddress` | Yes | Address of the deployed code object to upgrade |
| `namedAddresses` | No | Additional named address mappings |
| `includedArtifacts` | No | If true, includes artifacts in the package |
| `chunked` | No | If true, uses chunked upload for large packages |
| `gasUnitPrice` | No | Gas unit price |
| `maxGas` | No | Maximum gas units |
| `expirationSecs` | No | Transaction expiration in seconds |
| `includeEvents` | No | If true, includes events in the result |
| `extraFlags` | No | Additional flags passed to the CLI command |

**`publishPackage(options)`** — Publish a package to an account.

| Option | Required | Description |
|--------|----------|-------------|
| `sender` | Yes | Profile name or address (package published to this account) |
| `packageDir` | Yes | Path to the Move package |
| `namedAddresses` | No | Named address mappings |
| `includedArtifacts` | No | If true, includes artifacts in the package |
| `chunked` | No | If true, uses chunked upload for large packages |
| `gasUnitPrice` | No | Gas unit price |
| `maxGas` | No | Maximum gas units |
| `expirationSecs` | No | Transaction expiration in seconds |
| `includeEvents` | No | If true, includes events in the result |
| `extraFlags` | No | Additional flags passed to the CLI command |

### Reading State

**`runViewFunction(options)`** — Call a view function and retrieve its result.

```typescript
const result = harness.runViewFunction({
  functionId: "0x1::coin::balance",
  args: ["address:0x123"],
  typeArgs: ["0x1::aptos_coin::AptosCoin"],
});
const balance = result.Result[0];
```

| Option | Required | Description |
|--------|----------|-------------|
| `functionId` | Yes | Fully qualified view function ID |
| `args` | No | Typed arguments |
| `typeArgs` | No | Type arguments |
| `extraFlags` | No | Additional flags passed to the CLI command |

**Other read methods:**

| Method | Description |
|--------|-------------|
| `viewResource(account, resource)` | Read a resource from an account. |
| `getAPTBalanceFungibleStore(account)` | Get APT balance for an account. |
| `getCurrentTimeMicros()` | Get the current chain timestamp. |
| `getGasSchedule()` | Get the gas schedule. |

### Harness Lifecycle Management

| Method | Description |
|--------|-------------|
| `cleanup()` | Clean up the system resources used by the Harness (e.g. temp files or directories). Always call when done. |
| `getWorkingDir()` | Get the temporary working directory path. |
| `getSessionPath()` | Get the simulation session path. |

## More Examples

- **[TipJar](./packages/example-tip-jar/)** — Full tutorial covering the develop → test → deploy → interact workflow
- **[Testsuite](./packages/testsuite/)** — Internal tests demonstrating various Forklift features
- **[Live Tests](./packages/live-tests/)** — Examples using live mode against a real node. Note: you must spawn and manage your own local node (via the Aptos CLI or SDK) to run these. Prefer local simulation mode when possible — it's simpler to set up, more flexible and provides better isolation.

## Forklift vs. Aptos TS SDK

Forklift and the [Aptos TypeScript SDK](https://github.com/aptos-labs/aptos-ts-sdk) serve different purposes:

- **Forklift** is for **testing and scripting** — use it when developing Move contracts, writing integration tests, or scripting deployments.
- **Aptos TS SDK** is for **building applications** — use it when building frontends, wallets, or any app that interacts with the blockchain.

They're complementary: develop, test, deploy and manage your contracts with Forklift, then use the SDK to build client applications that interact with them.

## Known Limitations

- **No arbitrary resource modification** — Forklift does not yet support modifying arbitrary on-chain resources during simulation. This is planned for a future release.
- **No debugging tool integration** — Integration with the Gas Profiler and other debugging tools is not yet available. This is also planned for the future.

## Contributing

Contributions of all kinds are welcome!

- **Questions?** File an issue.
- **Found a bug or want a feature?** Submit a PR.

No prior approval is required, especially for small changes. For larger changes, we recommend starting a discussion first by opening an issue.

## License

Apache-2.0
