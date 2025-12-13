import { spawnSync } from "child_process";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  Account,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import yaml from "js-yaml";
import { parse as parseToml } from "smol-toml";

const APTOS_BINARY = "aptos";

const path = require("path");

// TODOs
// - Object code publishing
// - Large package publishing
// - Alt backend: real network
// - Additional options for certain commands
// - Tests: forking
// - Test-only APIs
//   - rotate key
//   - set resource
//   - set resource in group

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
    const stdout = result.stdout || "(no output)";
    const stderr = result.stderr || "(no output)";

    throw new Error(
      `Process exited with code ${result.status}.\n\n` +
        `Stdout:\n${stdout}\n` +
        `Stderr:\n${stderr}`,
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

/**
 * Gets the package name from the manifest (Move.toml) file in the given package directory.
 *
 * @returns The package name as a string.
 */
function getMovePackageNameFromManifest(packageDir: string): string {
  const moveTomlPath = join(packageDir, "Move.toml");
  if (!existsSync(moveTomlPath)) {
    throw new Error(`Move.toml not found at ${moveTomlPath}`);
  }
  const content = readFileSync(moveTomlPath, "utf8");

  try {
    const parsed = parseToml(content) as any;
    if (!parsed.package || !parsed.package.name) {
      throw new Error(`Could not find package.name in ${moveTomlPath}`);
    }
    return parsed.package.name;
  } catch (e) {
    throw new Error(`Failed to parse ${moveTomlPath}: ${e}`);
  }
}

interface TestHarnessOptions {
  network?: string;
  apiKey?: string;
  networkVersion?: number | string | bigint;
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

interface MoveRunScriptOptions {
  profile: string;
  scriptPath?: string;
  packageDir: string;
  scriptName: string;
  namedAddresses?: { [key: string]: string };
  args?: string[];
  typeArgs?: string[];
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

interface DeployCodeObjectOptions {
  profile: string;
  packageDir: string;
  packageAddressName: string;

  namedAddresses?: { [key: string]: string };
  includedArtifacts?: string;
}

interface UpgradeCodeObjectOptions {
  profile: string;
  packageDir: string;
  packageAddressName: string;
  objectAddress: string;

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
 *
 * To prevent misuse of the harness after it has been cleaned up, the class uses a Proxy
 * pattern. The constructor returns a Proxy that intercepts all method calls. If the
 * `cleanup()` method has been called (setting `poisoned` to true), any subsequent method
 * call (except `cleanup` itself) will throw an error. This ensures that the harness
 * cannot be used to interact with a non-existent temporary directory.
 */
class TestHarness {
  private workingDir: string;
  private poisoned: boolean;

  getWorkingDir(): string {
    return this.workingDir;
  }

  getSessionPath(): string {
    return join(this.workingDir, "data");
  }

  constructor(options: TestHarnessOptions = {}) {
    // Create a temporary directory with a unique name
    this.workingDir = mkdtempSync(join(tmpdir(), "move-test-"));
    this.poisoned = false;

    this.init_cli_profile("default");
    this.init_session(options);
    this.fundAccount("default", 10000000000 /* 100 APT */);

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);
        if (
          (target as any).poisoned &&
          typeof value === "function" &&
          prop !== "cleanup"
        ) {
          return () => {
            throw new Error(
              "TestHarness is poisoned: cleanup() has already been called",
            );
          };
        }
        return value;
      },
    });
  }

  /**
   * Initialize the Aptos CLI profile in the temporary directory.
   * If a private key is not provided, a random one will be generated.
   *
   * This is currently done by appending a new profile to the CLI's config file
   * (`.aptos/config.yaml`) as opposed to running the CLI's `init` command, in order to
   * avoid unnecessary communication with the actual network.
   *
   * @throws Error if the initialization fails.
   */
  init_cli_profile(profile_name: string, privateKey?: string): void {
    const privKey = privateKey
      ? new Ed25519PrivateKey(
          PrivateKey.formatPrivateKey(privateKey, PrivateKeyVariants.Ed25519),
        )
      : Ed25519PrivateKey.generate();

    const pubKey = privKey.publicKey();
    const addr = Account.fromPrivateKey({
      privateKey: privKey,
    }).accountAddress.toString();

    let profile = {
      network: "Local",
      rest_url: "https://dummy.network.aptoslabs.com",
      account: addr,
      private_key: privKey.toAIP80String(),
      public_key: "ed25519-pub-" + pubKey.toString(),
    };

    const aptosDir = join(this.workingDir, ".aptos");
    const configPath = join(aptosDir, "config.yaml");

    if (!existsSync(aptosDir)) {
      mkdirSync(aptosDir, { recursive: true });
    }

    let config: any = { profiles: {} };
    if (existsSync(configPath)) {
      try {
        const fileContent = readFileSync(configPath, "utf8");
        config = yaml.load(fileContent) || { profiles: {} };
        if (!config.profiles) {
          config.profiles = {};
        }
      } catch (e) {
        throw new Error(
          `Failed to parse existing config at ${configPath}: ${e}`,
        );
      }
    }

    if (config.profiles[profile_name]) {
      throw new Error(
        `Profile ${profile_name} already exists in ${configPath}`,
      );
    }
    config.profiles[profile_name] = profile;

    writeFileSync(
      configPath,
      yaml.dump(config, { indent: 2, sortKeys: true, lineWidth: 120 }),
    );
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

      if (options.networkVersion) {
        args.push("--network-version", options.networkVersion.toString());
      }
    } else {
      if (options.network || options.apiKey) {
        throw new Error(
          "Both network and apiKey must be provided together, or neither",
        );
      }
      if (options.networkVersion) {
        throw new Error("networkVersion cannot be set when network is not set");
      }
    }

    const res = runCommand(APTOS_BINARY, args, {
      cwd: this.workingDir,
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
  fundAccount(account: string, amount: number | bigint | string): void {
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
        cwd: this.workingDir,
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
      cwd: this.workingDir,
    });

    return res;
  }

  /**
   * Runs a Move script. Will automatically compile the package before running the script.
   * As the caller, you are responsible for supplying the correct named addresses for the package.
   *
   * @returns The execution result as a JSON object.
   * @throws Error if running into non-execution failures (including compilation errors).
   */
  runMoveScript(options: MoveRunScriptOptions): any {
    const compileArgs = [
      "move",
      "compile",
      "--package-dir",
      options.packageDir,
    ];

    if (options.namedAddresses) {
      compileArgs.push("--named-addresses");
      compileArgs.push(
        Object.entries(options.namedAddresses)
          .map(([key, value]) => `${key}=${value}`)
          .join(","),
      );
    }

    runCommand(APTOS_BINARY, compileArgs, {
      cwd: this.workingDir,
    });

    const packageName = getMovePackageNameFromManifest(options.packageDir);

    // prettier-ignore
    const runArgs = [
      "move", "run-script",
      "--session", this.getSessionPath(),
      "--profile", options.profile,
      "--compiled-script-path", join(options.packageDir, "build", packageName, "bytecode_scripts", options.scriptName + ".mv"),
    ];

    // Add optional type arguments
    if (options.typeArgs && options.typeArgs.length > 0) {
      runArgs.push("--type-args");
      runArgs.push(...options.typeArgs);
    }

    // Add optional arguments
    if (options.args && options.args.length > 0) {
      runArgs.push("--args");
      runArgs.push(...options.args);
    }

    // Add optional gas unit price
    if (options.gasUnitPrice !== undefined) {
      runArgs.push("--gas-unit-price", options.gasUnitPrice.toString());
    }

    // Add optional max gas
    if (options.maxGas !== undefined) {
      runArgs.push("--max-gas", options.maxGas.toString());
    }

    // Add optional expiration seconds
    if (options.expirationSecs !== undefined) {
      runArgs.push("--expiration-secs", options.expirationSecs.toString());
    }

    const res = runCommand(APTOS_BINARY, runArgs, {
      cwd: this.workingDir,
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
      cwd: this.workingDir,
    });

    return res;
  }

  /**
   * Deploys a Move package to an object.
   *
   * @returns The deployment result as a JSON object
   * @throws Error if running into non-execution failures.
   */
  deployCodeObject(options: DeployCodeObjectOptions): any {
    // prettier-ignore
    const args = [
      "move", "deploy-object",
      "--assume-yes",
      "--session", this.getSessionPath(),
      "--profile", options.profile,
      "--package-dir", options.packageDir,
      "--address-name", options.packageAddressName,
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
      cwd: this.workingDir,
    });

    return res;
  }

  upgradeCodeObject(options: UpgradeCodeObjectOptions): any {
    // prettier-ignore
    const args = [
      "move", "upgrade-object",
      "--assume-yes",
      "--session", this.getSessionPath(),
      "--profile", options.profile,
      "--package-dir", options.packageDir,
      "--address-name", options.packageAddressName,
      "--object-address", options.objectAddress,
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
      cwd: this.workingDir,
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
      cwd: this.workingDir,
    });

    return res;
  }

  /**
   * Views a resource group.
   *
   * @returns The resource group as a JSON object -- a map from resource type names
   * to individual resource objects.
   */
  viewResourceGroup(
    account: string,
    resourceGroup: string,
    derivedObjectAddress?: string,
  ): any {
    const args = [
      "move",
      "sim",
      "view-resource-group",
      "--session",
      this.getSessionPath(),
      "--account",
      account,
      "--resource-group",
      resourceGroup,
    ];

    if (derivedObjectAddress) {
      args.push("--derived-object-address", derivedObjectAddress);
    }

    return runCommand(APTOS_BINARY, args, { cwd: this.workingDir });
  }

  /**
   * Views a specific resource from the simulation session.
   *
   * @returns The resource as a JSON object.
   */
  viewResource(account: string, resource: string): any {
    const args = [
      "move",
      "sim",
      "view-resource",
      "--session",
      this.getSessionPath(),
      "--account",
      account,
      "--resource",
      resource,
    ];

    return runCommand(APTOS_BINARY, args, { cwd: this.workingDir });
  }

  /**
   * Gets the APT balance from the Fungible Store for a given account.
   * Uses the primary store derived from the account and the APT metadata address (0xA).
   *
   * @returns The APT balance as a bigint.
   */
  getAPTBalanceFungibleStore(account: string): bigint {
    const res = this.viewResourceGroup(
      account,
      "0x1::object::ObjectGroup",
      "0xA",
    );

    if (
      !res ||
      !res.Result ||
      !res.Result["0x1::fungible_asset::FungibleStore"]
    ) {
      return BigInt(0);
    }

    return BigInt(res.Result["0x1::fungible_asset::FungibleStore"].balance);
  }

  cleanup(): void {
    this.poisoned = true;
    try {
      rmSync(this.workingDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(
        `Failed to cleanup temporary directory ${this.workingDir}:`,
        error,
      );
    }
  }

  /**
   * Gets the current timestamp in microseconds.
   *
   * @returns The current time micros as a bigint.
   */
  getCurrentTimeMicros(): bigint {
    const res = this.viewResource(
      "0x1",
      "0x1::timestamp::CurrentTimeMicroseconds",
    );

    if (!res || !res.Result || !res.Result.microseconds) {
      throw new Error("Failed to get current time micros");
    }

    return BigInt(res.Result.microseconds);
  }

  /**
   * Gets the current gas schedule.
   *
   * @returns The gas schedule as a JSON object.
   */
  getGasSchedule(): any {
    const res = this.viewResource("0x1", "0x1::gas_schedule::GasScheduleV2");

    if (!res || !res.Result) {
      throw new Error("Failed to get gas schedule");
    }

    return res.Result;
  }

  /**
   * Gets the account address for a given profile.
   *
   * @returns The account address as a string.
   */
  getAccountAddress(profile: string): string {
    const res = runCommand(APTOS_BINARY, ["config", "show-profiles"], {
      cwd: this.workingDir,
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
  TestHarness,
  type TestHarnessOptions,
  type MoveRunOptions,
  type ViewOptions,
  type PublishOptions,
  type DeployCodeObjectOptions as DeployObjectOptions,
};
