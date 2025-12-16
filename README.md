# Forklift

Forklift is a lightweight integration testing and simulation framework for Aptos Move smart contracts. It enables you to script complex transaction simulations and integration tests directly in TypeScript, giving you full programmatic control over the simulation environment.

Designed for modern CI/CD pipelines, Forklift lets you simulate transactions against either a clean local state or a **forked network state** (Devnet/Mainnet/Testnet).

## Features

- **Network Forking**: Instantly fork Mainnet, Testnet, or Devnet state to test against real-world data and protocols.
- **TypeScript Native**: Write your test logic in standard TypeScript. No need to learn a new testing DSL.
- **Programmable Simulation**: Script multi-step scenarios, manipulate chain state, and inspect resources with the full power of Node.js.
- **Easy Setup**: No need to manually spawn or manage a local validator node. Forklift handles the simulation environment lifecycle automatically.
- **Isolated & Repeatable**: Each test runs in a fresh, ephemeral session, ensuring deterministic results and preventing state pollution—perfect, which is essential for CI/CD.

## Prerequisites

- **Node.js**: Minimum v18.
- **Aptos CLI**: You must have the [Aptos CLI](https://aptos.dev/tools/aptos-cli/) installed and available in your `PATH`.
  - Ensure you have a version that supports `transaction simulation sessions` (7.12.0 and above).

## Installation

Run the following command within your TypeScript project to install Forklift as a development dependency:

```bash
npm install --save-dev @aptos-labs/forklift
```

## Usage

TBA

## API Reference

TBA

## License
Apache-2.0
