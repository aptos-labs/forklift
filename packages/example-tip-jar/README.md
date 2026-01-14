# TipJar

This tutorial walks you through building and deploying an Aptos Move contract using Forklift. By the end, you'll understand the full **develop → test → deploy → interact** workflow.

## What You'll Build

TipJar is a simple donation contract. Create a tip jar, let anyone donate APT to it, and withdraw the funds as the owner. We chose this example because it's simple enough to understand quickly, but covers all the key concepts: deploying code, creating objects, handling funds, and managing ownership.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [Aptos CLI](https://aptos.dev/tools/aptos-cli/) (for Move compilation)

## Quick Start

Let's verify everything works before diving in:

```bash
npm install
npm test
```

Notice that the tests pass without any network setup or testnet tokens. This is Forklift's local simulation mode at work — it runs a complete Aptos execution environment in memory, so you can develop and test without external dependencies.

---

## The Move Contract

The TipJar contract lets you:

- **Create** a named tip jar — you become the owner
- **Donate** APT to any jar — anyone can do this
- **Withdraw** all funds from your jar — owner only
- **Transfer** ownership to someone else — owner only
- **Query** a jar's name, balance, and owner

Each tip jar is modeled as an [Aptos Object](https://aptos.dev/en/build/smart-contracts/objects) that holds APT in its fungible store.

📄 [View the source](./move/tip_jar/sources/tip_jar.move)

---

## Forklift Modes and Workflows

A typical development workflow moves through three stages, and Forklift provides a mode for each:

| Mode | Harness | Use for |
|------|---------|---------|
| **Local** | `Harness.createLocal()` | Development and testing — runs in memory, instant execution |
| **Fork** | `Harness.createNetworkFork("testnet", apiKey)` | Dry-run — tests against real chain state without affecting it |
| **Live** | `Harness.createLive("testnet")` | Production — executes real transactions, costs gas |

The key insight: your code stays the same across all modes. You define **workflow functions** that take a `Harness` parameter, and the mode is determined by how you create the harness:

```typescript
// workflows.ts
import { Harness } from "@aptos-labs/forklift";

export function donate(
  harness: Harness,
  codeAddress: string,
  sender: string,
  jarAddress: string,
  amount: number,
): void {
  const result = harness.runMoveFunction({
    sender,
    functionId: `${codeAddress}::tip_jar::donate`,
    args: [`address:${jarAddress}`, `u64:${amount}`],
  });
  if (!result.Result?.success) {
    throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
  }
}
```

The `donate` function doesn't know or care which mode it's running in. This means the same workflow logic gets tested locally, dry-run in fork mode, and executed in live mode:

```typescript
// In tests — local simulation
const harness = Harness.createLocal();
donate(harness, codeAddress, "alice", jarAddress, 100_000_000);

// In scripts — dry-run against real state
const harness = Harness.createNetworkFork("testnet", apiKey);
donate(harness, codeAddress, "alice", jarAddress, 100_000_000);

// In scripts — execute for real
const harness = Harness.createLive("testnet");
donate(harness, codeAddress, "alice", jarAddress, 100_000_000);
```

📄 [View all workflows](./src/workflows.ts)

---

## Writing Tests

With workflows defined, writing tests becomes straightforward. We use [Jest](https://jestjs.io/) (standard Node.js testing framework) — create a local harness, set up some test accounts, and call your workflow functions:

```typescript
import { Harness } from "@aptos-labs/forklift";
import { deployPackage, createJar, donate, getBalance } from "../workflows";

describe("TipJar", () => {
  // Create a local harness — tests run in memory, no network needed
  const harness = Harness.createLocal();

  beforeAll(() => {
    // Create test accounts and give them some APT to work with
    harness.init_cli_profile("owner");
    harness.init_cli_profile("donor");
    harness.fundAccount("owner", 1_000_000_000);
    harness.fundAccount("donor", 1_000_000_000);
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("deploy and create jar", () => {
    // Deploy the contract and create a jar — using the same workflow
    // functions we'll use in scripts later
    const codeAddress = deployPackage(harness, "owner");
    const jarAddress = createJar(harness, codeAddress, "owner", "Coffee Fund");
    
    expect(getBalance(harness, codeAddress, jarAddress)).toBe(0n);
  });

  it("accept donations", () => {
    donate(harness, codeAddress, "donor", jarAddress, 50_000_000);
    expect(getBalance(harness, codeAddress, jarAddress)).toBe(50_000_000n);
  });
});
```

Because tests use the same workflow functions as your scripts, you can be confident that what works in tests will work in production.

📄 [View full test suite](./src/tests/integration.test.ts)

---

## Scripting

Once your tests pass locally, you're ready to interact with a real network. You can write scripts to make this easy.

At a high level, each script:
1. Reads **configuration** (which network, deployed addresses) and **credentials** (private keys)
2. Parses command-line arguments
3. Creates a Forklift harness and calls your workflow functions

In our current approach, we store configuration and credentials in files so you don't have to pass them every time. This project separates them into two files:

- **`config.json`** — Public info (network, deployed addresses). Safe to commit.
- **`~/.tip-jar/credentials.json`** — Private keys and API keys. Never commit this.

We store credentials in your home directory (not the project) to reduce the risk of accidentally committing them. But be careful: **private keys give full control of your accounts**. This approach is simple but not bulletproof — for production use, consider hardware wallets, environment variables, or secret management tools. Find something that works for your security requirements.

```json
// config.json (public)
{
  "network": "devnet",
  "codeAddress": "0x123...",
  "jars": { "coffee": "0x456..." }
}

// ~/.tip-jar/credentials.json (private)
{
  "accounts": { "alice": "0xYOUR_PRIVATE_KEY" },
  "apiKey": "YOUR_API_KEY"
}
```

See [credentials.template.json](./credentials.template.json) for the format.

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run init` | Initialize config file |
| `npm run deploy` | Deploy or upgrade the contract |
| `npm run create` | Create a new tip jar |
| `npm run donate` | Donate APT to a jar |
| `npm run withdraw` | Withdraw funds (owner only) |
| `npm run transfer` | Transfer ownership |
| `npm run status` | Check jar status |

By default, commands run in **fork mode** (dry-run). Add `--live` to execute for real:

| Flag | Description |
|------|-------------|
| `--live` | Execute on real network (default: fork/dry-run) |
| `--config <path>` | Config file path (default: `config.json`) |
| `--credentials <path>` | Credentials path (default: `~/.tip-jar/credentials.json`) |

---

## Full Walkthrough

Let's put it all together. Here's how to deploy TipJar to devnet and interact with it:

### 1. Setup credentials

First, create a credentials file with your private key. We store this in your home directory (not the project) so you don't accidentally commit it:

```bash
mkdir ~/.tip-jar
cp credentials.template.json ~/.tip-jar/credentials.json
# Edit ~/.tip-jar/credentials.json with your private key
```

### 2. Initialize config

Create a config file that specifies which network to use:

```bash
npm run init -- --network devnet
```

### 3. Deploy the contract

Always dry-run first to make sure everything works:

```bash
# Dry-run — runs against forked devnet state but doesn't actually deploy
npm run deploy -- --account alice

# Looks good? Deploy for real
npm run deploy -- --account alice --live
```

### 4. Create a tip jar

```bash
npm run create -- --jar "Coffee Fund" --account alice --live
```

### 5. Check status

The status command uses fork mode (read-only) to query the jar:

```bash
npm run status -- --jar coffee-fund
```

Output:
```
TipJar: Coffee Fund
  Address: 0x456...
  Balance: 0 APT
  Owner: 0x789...
```

### 6. Donate

```bash
npm run donate -- --jar coffee-fund --amount 0.5 --account bob --live
```

Check the balance updated:

```bash
npm run status -- --jar coffee-fund
# Balance: 0.5 APT
```

### 7. Withdraw

```bash
npm run withdraw -- --jar coffee-fund --account alice --live
```

---

## Next Steps

Now that you understand the workflow, try these:

1. **Modify the contract** — Add a feature (maybe a minimum donation amount?) and run `npm test` to see your changes instantly
2. **Read the Move source** — See how TipJar uses [Aptos Objects](./move/tip_jar/sources/tip_jar.move) under the hood
3. **Explore Forklift** — Check out the [Forklift documentation](https://github.com/aptos-labs/forklift) for more features
