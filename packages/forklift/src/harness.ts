import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const APTOS_BINARY = "aptos";

const path = require("path");

function stripNodeModulesBin(pathEnv: string) {
  return pathEnv
    .split(path.delimiter)
    .filter((p) => !p.includes("node_modules/.bin"))
    .join(path.delimiter);
}

const cleanPath = stripNodeModulesBin(process.env.PATH || "");

/**
 * Executes a shell command and parses its output as JSON.
 *
 * If the output contains mixed text and JSON, only the JSON portion at the end will be parsed for robustness.
 *
 * @returns The parsed JSON object from the command's output
 * @throws Error if the command fails or output cannot be parsed as JSON
 */
export function runCommand(
  command: string,
  args: string[] = [],
  options: { cwd?: string } = {},
): any {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    shell: false,
    encoding: "utf8",
    env: {
      PATH: cleanPath,
    },
  });

  if (result.error) {
    throw new Error(`Failed to start process: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Process exited with code ${result.status}: ${result.stderr}`,
    );
  }

  try {
    // Find the last line that starts with '{' (trailing spaces are allowed)
    // This is considered to be the beginning of the JSON object
    const lines = result.stdout.split("\n");
    let jsonStartLine = -1;

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line?.trimEnd() === "{") {
        jsonStartLine = i;
        break;
      }
    }

    if (jsonStartLine === -1) {
      throw new Error("No JSON object found in output");
    }

    const jsonString = lines.slice(jsonStartLine).join("\n");
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (e) {
    throw new Error(
      `Failed to parse process output as JSON.\nStdout:\n${result.stdout}\nStderr:\n${result.stderr}`,
    );
  }
}

interface TestHarnessOptions {
  network?: string;
  apiKey?: string;
}

interface MoveRunOptions {
  profile: string;
  functionId: string;
  typeArgs?: string[];
  args?: string[];
  gasUnitPrice?: number;
  maxGas?: number;
  expirationSecs?: number;
}

interface ViewOptions {
  functionId: string;
  typeArgs?: string[];
  args?: string[];
}

interface PublishOptions {
  profile: string;
  packageDir: string;
  namedAddresses?: { [key: string]: string };
  includedArtifacts?: string;
}

/**
 * A test harness that provides a repeatable environment for testing Aptos transactions.
 *
 * Offers methods to interact with the simulated network state and provides
 * "backdoor" APIs to manipulate the network state for testing purposes.
 *
 * Supports both local state and remote state (network forking) as the base
 * state for simulations.
 *
 * Under the hood, it uses the Transaction Simulation Session feature from the Aptos CLI.
 */
class TestHarness {
  private tempDir: string;

  getTempDir(): string {
    return this.tempDir;
  }

  getSessionPath(): string {
    return join(this.tempDir, "data");
  }

  constructor(options: TestHarnessOptions = {}) {
    // Create a temporary directory with a unique name
    this.tempDir = mkdtempSync(join(tmpdir(), "move-test-"));

    this.init_cli_profile("default");
    this.init_session(options);
    this.fundAccount("default", 10000000000 /* 100 APT */);

    // Auto-cleanup if running in Jest, Vitest, Jasmine, or Mocha
    //
    // Jest, Vitest, and Jasmine use `afterAll`, while Mocha uses `after`.
    // We check for both and register the cleanup hook accordingly.
    const globalAny = globalThis as any;
    if (typeof globalAny.afterAll === "function") {
      globalAny.afterAll(() => this.cleanup());
    } else if (typeof globalAny.after === "function") {
      globalAny.after(() => this.cleanup());
    }
  }

  /**
   * Initialize the Aptos CLI profile in the temporary directory.
   *
   * If a private key is not provided, a random one will be generated.
   *
   * @throws Error if the initialization fails.
   */
  init_cli_profile(profile_name: string, privateKey?: string): void {
    const pk = privateKey
      ? privateKey
      : Ed25519PrivateKey.generate().toHexString();

    // prettier-ignore
    const res = runCommand(
      APTOS_BINARY,
      [
        "init",
        "--profile", profile_name,
        "--network", "mainnet",
        "--skip-faucet",
        "--private-key", pk,
      ],
      {
        cwd: this.tempDir,
      },
    );

    if (!res || res.Result !== "Success") {
      throw new Error(
        `aptos init failed: expected Result = Success, got ${JSON.stringify(res)}`,
      );
    }
  }

  /**
   * Initialize the Aptos Transaction Simulation Session.
   *
   * Sets up a simulation environment for testing Aptos transactions. If both network and API key
   * are provided, they will be used to connect to the specified network. Otherwise, a local
   * simulation session will be used.
   *
   * @throws Error if both network and apiKey are not provided together, or if the initialization fails
   */
  private init_session(options: TestHarnessOptions): void {
    const args = ["move", "sim", "init", "--path", this.getSessionPath()];

    // Add network and API key if both are provided
    if (options.network && options.apiKey) {
      args.push("--network", options.network);
      args.push("--api-key", options.apiKey);
    } else if (options.network || options.apiKey) {
      throw new Error(
        "Both network and apiKey must be provided together, or neither",
      );
    }

    const res = runCommand(APTOS_BINARY, args, {
      cwd: this.tempDir,
    });

    if (!res || res.Result !== "Success") {
      throw new Error(
        `aptos init failed: expected Result = Success, got ${JSON.stringify(res)}`,
      );
    }
  }

  /**
   * Fund an account with APT tokens for testing purposes.
   *
   * Adds the specified amount of APT tokens to the given account's fungible store.
   * This provides accounts with sufficient balance for sending transactions or performing other operations.
   *
   * @throws Error if the funding operation fails
   */
  fundAccount(account: string, amount: number): void {
    // prettier-ignore
    const res = runCommand(
      APTOS_BINARY,
      [
        "move", "sim", "fund",
        "--session", this.getSessionPath(),
        "--account", account,
        "--amount", amount.toString(),
      ],
      {
        cwd: this.tempDir,
      },
    );

    // FIXME: handle non-existent profile

    if (!res || res.Result !== "Success") {
      throw new Error(
        `aptos fund failed: expected Result = Success, got ${JSON.stringify(res)}`,
      );
    }
  }

  /**
   * Runs a Move function identified by its fully qualified function ID with the specified
   * arguments and options.
   *
   * @returns The execution result as a JSON object
   * @throws Error if running into non-execution failures.
   */
  runMoveFunction(options: MoveRunOptions): any {
    // prettier-ignore
    const args = [
      "move", "run",
      "--session", this.getSessionPath(),
      "--profile", options.profile,
      "--function-id", options.functionId,
    ];

    // Add optional type arguments
    if (options.typeArgs && options.typeArgs.length > 0) {
      args.push("--type-args");
      args.push(...options.typeArgs);
    }

    // Add optional arguments
    if (options.args && options.args.length > 0) {
      args.push("--args");
      args.push(...options.args);
    }

    // Add optional gas unit price
    if (options.gasUnitPrice !== undefined) {
      args.push("--gas-unit-price", options.gasUnitPrice.toString());
    }

    // Add optional max gas
    if (options.maxGas !== undefined) {
      args.push("--max-gas", options.maxGas.toString());
    }

    // Add optional expiration seconds
    if (options.expirationSecs !== undefined) {
      args.push("--expiration-secs", options.expirationSecs.toString());
    }

    const res = runCommand(APTOS_BINARY, args, {
      cwd: this.tempDir,
    });

    return res;
  }

  /**
   * Deploys a Move package with the specified options including named addresses
   * and included artifacts.
   *
   * @returns The publication result as a JSON object
   * @throws Error if running into non-execution failures.
   */
  publishPackage(options: PublishOptions): any {
    // prettier-ignore
    const args = [
      "move", "publish",
      "--session", this.getSessionPath(),
      "--profile", options.profile,
      "--package-dir", options.packageDir,
    ];

    if (options.namedAddresses) {
      args.push("--named-addresses");
      args.push(
        Object.entries(options.namedAddresses)
          .map(([key, value]) => `${key}=${value}`)
          .join(","),
      );
    }

    if (options.includedArtifacts) {
      args.push("--included-artifacts");
      args.push(options.includedArtifacts);
    }

    const res = runCommand(APTOS_BINARY, args, {
      cwd: this.tempDir,
    });

    return res;
  }

  /**
   * Runs a read-only Move function identified by its fully qualified function ID
   * with the specified arguments and type arguments.
   *
   * @returns The view function result
   * @throws Error if running into non-execution failures.
   */
  runViewFunction(options: ViewOptions): any {
    // prettier-ignore
    const args = [
      "move", "view",
      "--session", this.getSessionPath(),
      "--function-id", options.functionId,
    ];

    if (options.typeArgs && options.typeArgs.length > 0) {
      args.push("--type-args");
      args.push(...options.typeArgs);
    }

    if (options.args && options.args.length > 0) {
      args.push("--args");
      args.push(...options.args);
    }

    const res = runCommand(APTOS_BINARY, args, {
      cwd: this.tempDir,
    });

    return res;
  }

  cleanup(): void {
    try {
      rmSync(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(
        `Failed to cleanup temporary directory ${this.tempDir}:`,
        error,
      );
    }
  }

  getAccountAddress(profile: string): string {
    const res = runCommand(APTOS_BINARY, ["config", "show-profiles"], {
      cwd: this.tempDir,
    });

    if (!res || !res.Result || !res.Result[profile]) {
      throw new Error(`Profile ${profile} not found`);
    }

    // Return the account address with 0x prefix if missing
    let addr = res.Result[profile].account;
    if (!addr.startsWith("0x")) {
      addr = "0x" + addr;
    }
    return addr;
  }
}

export {
  TestHarness, type TestHarnessOptions,
  type MoveRunOptions,
  type ViewOptions,
  type PublishOptions,
};
