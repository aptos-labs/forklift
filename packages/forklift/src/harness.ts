import { spawnSync } from "child_process";
import crypto from "crypto";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import path, { join } from "path";
import { tmpdir } from "os";
import {
  Account,
  Ed25519PrivateKey,
  PrivateKey,
  PrivateKeyVariants,
} from "@aptos-labs/ts-sdk";
import yaml from "js-yaml";
import { parse as parseToml } from "smol-toml";
import assert from "assert";
import fetch from "sync-fetch";

const APTOS_BINARY = "aptos";

// TODOs
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
 * Computes a derived object address using SHA3-256.
 * This matches Move's object::create_user_derived_object_address(source, derive_from).
 *
 * @param sourceAddress - The source/owner address (with or without 0x prefix).
 * @param deriveFromAddress - The address to derive from (with or without 0x prefix).
 * @returns The derived address as a hex string with 0x prefix.
 */
function computeDerivedObjectAddress(
  sourceAddress: string,
  deriveFromAddress: string,
): string {
  // Normalize addresses to 32 bytes (64 hex chars without 0x prefix)
  const sourceBytes = Buffer.from(
    sourceAddress.replace("0x", "").padStart(64, "0"),
    "hex",
  );
  const deriveFromBytes = Buffer.from(
    deriveFromAddress.replace("0x", "").padStart(64, "0"),
    "hex",
  );
  const suffix = Buffer.from([0xfc]); // DERIVE_OBJECT_FROM_OBJECT_SCHEME

  const hash = crypto.createHash("sha3-256");
  hash.update(sourceBytes);
  hash.update(deriveFromBytes);
  hash.update(suffix);

  return "0x" + hash.digest("hex");
}

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

interface HarnessOptions {
  network?: string;
  apiKey?: string;
  networkVersion?: number | string | bigint;
  mode: "simulation" | "live";
  faucetUrl?: string;
}

interface TransactionOptions {
  sender: string;
  gasUnitPrice?: number;
  maxGas?: number;
  expirationSecs?: number;
}

interface FunctionCallOptions {
  typeArgs?: string[];
  args?: string[];
}

interface PackageOptions {
  namedAddresses?: { [key: string]: string };
  includedArtifacts?: string;
  chunked?: boolean;
}

interface MoveRunOptions extends TransactionOptions, FunctionCallOptions {
  functionId: string;
  extraFlags?: string[];
  /**
   * If true, fetches and includes events in the result.
   * - In simulation mode: reads events from the session's events.json file
   * - In live mode: fetches the transaction from REST API to get events
   */
  includeEvents?: boolean;
}

interface MoveRunScriptOptions extends TransactionOptions, FunctionCallOptions {
  scriptPath?: string;
  packageDir: string;
  scriptName: string;
  namedAddresses?: { [key: string]: string };
  compileExtraFlags?: string[];
  runExtraFlags?: string[];
  /**
   * If true, fetches and includes events in the result.
   */
  includeEvents?: boolean;
}

interface ViewOptions extends FunctionCallOptions {
  functionId: string;
  extraFlags?: string[];
}

interface PublishOptions extends TransactionOptions, PackageOptions {
  packageDir: string;
  extraFlags?: string[];
  /**
   * If true, fetches and includes events in the result.
   */
  includeEvents?: boolean;
}

interface DeployCodeObjectOptions extends TransactionOptions, PackageOptions {
  packageDir: string;
  packageAddressName: string;
  extraFlags?: string[];
  /**
   * If true, fetches and includes events in the result.
   */
  includeEvents?: boolean;
}

interface UpgradeCodeObjectOptions extends TransactionOptions, PackageOptions {
  packageDir: string;
  packageAddressName: string;
  objectAddress: string;
  extraFlags?: string[];
  /**
   * If true, fetches and includes events in the result.
   */
  includeEvents?: boolean;
}

function addTransactionOptions(args: string[], options: TransactionOptions) {
  if (options.gasUnitPrice !== undefined) {
    args.push("--gas-unit-price", options.gasUnitPrice.toString());
  }
  if (options.maxGas !== undefined) {
    args.push("--max-gas", options.maxGas.toString());
  }
  if (options.expirationSecs !== undefined) {
    args.push("--expiration-secs", options.expirationSecs.toString());
  }
}

function addNamedAddresses(
  args: string[],
  namedAddresses?: { [key: string]: string },
) {
  if (namedAddresses) {
    args.push("--named-addresses");
    args.push(
      Object.entries(namedAddresses)
        .map(([key, value]) => `${key}=${value}`)
        .join(","),
    );
  }
}

function addTypeArgsAndArgs(
  args: string[],
  options: { typeArgs?: string[]; args?: string[] },
) {
  if (options.typeArgs && options.typeArgs.length > 0) {
    args.push("--type-args", ...options.typeArgs);
  }
  if (options.args && options.args.length > 0) {
    args.push("--args", ...options.args);
  }
}

function addPackageOptions(
  args: string[],
  options: { includedArtifacts?: string; chunked?: boolean },
) {
  if (options.includedArtifacts) {
    args.push("--included-artifacts", options.includedArtifacts);
  }
  if (options.chunked) {
    args.push("--chunked-publish");
  }
}

/**
 * A unified harness for interacting with Aptos networks or perform local or forking-based
 * simulations.
 *
 * Offers methods to interact with the network state and provides utilities for
 * executing Move scripts, publishing packages, managing accounts etc.
 *
 * Supports three modes of operation:
 * 1. **Local Simulation**: Runs a fresh, local simulation session.
 * 2. **Network Forking**: Forks the state of a real network (Mainnet/Testnet) for simulation.
 * 3. **Live Mode**: Interacts directly with a real network (costs gas, changes state).
 *
 * Use the static factory methods to create a harness instance:
 * - `Harness.createLocal()`
 * - `Harness.createNetworkFork(network, apiKey)`
 * - `Harness.createLive(network)`
 *
 * Under the hood, it uses the Aptos CLI to execute commands.
 *
 * To prevent misuse of the harness after it has been cleaned up, the class uses a Proxy
 * pattern. The constructor returns a Proxy that intercepts all method calls. If the
 * `cleanup()` method has been called (setting `poisoned` to true), any subsequent method
 * call (except `cleanup` itself) will throw an error. This ensures that the harness
 * cannot be used to interact with a non-existent temporary directory.
 */
class Harness {
  private workingDir: string;
  private poisoned: boolean;
  private isLiveMode: boolean;
  private network: string;
  private restUrl: string;
  private faucetUrl: string | null;

  /**
   * Gets the working directory path for this harness instance.
   *
   * @returns The absolute path to the temporary working directory.
   */
  getWorkingDir(): string {
    return this.workingDir;
  }

  /**
   * Gets the session path used for simulation mode.
   *
   * @returns The absolute path to the simulation session data directory.
   */
  getSessionPath(): string {
    return join(this.workingDir, "data");
  }

  /**
   * Runs an Aptos CLI command in the harness working directory.
   */
  private runAptos(args: string[]): any {
    return runCommand(APTOS_BINARY, args, { cwd: this.workingDir });
  }

  private constructor(options: HarnessOptions) {
    // Create a temporary directory with a unique name
    this.workingDir = mkdtempSync(join(tmpdir(), "forklift-"));
    this.poisoned = false;
    this.isLiveMode = options.mode === "live";

    if (this.isLiveMode) {
      assert(options.network, "network is required in live mode");

      const net = options.network.toLowerCase();
      if (net === "mainnet") {
        this.network = "Mainnet";
        this.restUrl = "https://fullnode.mainnet.aptoslabs.com";
        this.faucetUrl = null; // No faucet on mainnet
      } else if (net === "testnet") {
        this.network = "Testnet";
        this.restUrl = "https://fullnode.testnet.aptoslabs.com";
        this.faucetUrl = null; // Testnet faucet requires web UI with Google auth
      } else if (net === "devnet") {
        this.network = "Devnet";
        this.restUrl = "https://fullnode.devnet.aptoslabs.com";
        this.faucetUrl = "https://faucet.devnet.aptoslabs.com";
      } else if (net === "local") {
        this.network = "Local";
        this.restUrl = "http://127.0.0.1:8080";
        this.faucetUrl = "http://127.0.0.1:8081";
      } else {
        this.network = "Custom";
        this.restUrl = options.network;
        this.faucetUrl = options.faucetUrl ?? null;
      }
    } else {
      this.network = "Custom";
      this.restUrl = "https://dummy.network.aptoslabs.com";
      this.faucetUrl = null;
    }

    this.init_cli_profile("default");

    if (!this.isLiveMode) {
      this.init_session(options);
      this.fundAccount("default", 10000000000 /* 100 APT */);
    }

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
              "Harness is poisoned: cleanup() has already been called",
            );
          };
        }
        return value;
      },
    });
  }

  /**
   * Creates a harness for local simulation.
   *
   * In this mode, the harness starts a fresh, local Aptos simulation session.
   * This is useful for unit testing Move contracts in isolation.
   *
   * @returns A new Harness instance configured for local simulation.
   */
  static createLocal(): Harness {
    return new Harness({ mode: "simulation" });
  }

  /**
   * Creates a harness for network forking simulation.
   *
   * In this mode, the harness initializes a simulation session that is forked from a real network
   * (e.g., Mainnet, Testnet) at a specific point in time (latest by default).
   * This allows testing against real-world state without spending gas or affecting the real network.

   * @returns A new Harness instance configured for network forking.
   */
  static createNetworkFork(
    network: string,
    apiKey: string,
    networkVersion?: number | string | bigint,
  ): Harness {
    return new Harness({
      mode: "simulation",
      network,
      apiKey,
      networkVersion,
    });
  }

  /**
   * Creates a harness for interacting with a live network ("Live Mode").
   *
   * In this mode, the harness acts as a wrapper around the Aptos CLI to execute transactions
   * directly against a real network (Mainnet, Testnet, Devnet, or a custom node).
   *
   * WARNING: Operations in this mode cost real gas and permanently alter the chain state.
   *
   * @param network - The network identifier. Can be "mainnet", "testnet", "devnet", "local", or a custom fullnode URL.
   * @param faucetUrl - Optional faucet URL for funding accounts. Auto-detected for known networks and localhost.
   * @returns A new Harness instance configured for live network interaction.
   */
  static createLive(network: string, faucetUrl?: string): Harness {
    return new Harness({
      mode: "live",
      network,
      faucetUrl,
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
      network: this.network,
      rest_url: this.restUrl,
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
  private init_session(options: HarnessOptions): void {
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

    const res = this.runAptos(args);

    if (!res || res.Result !== "Success") {
      throw new Error(
        `aptos init failed: expected Result = Success, got ${JSON.stringify(res)}`,
      );
    }
  }

  /**
   * Fund an account with APT tokens.
   *
   * In simulation mode, adds the specified amount of APT tokens directly to the account's fungible store.
   * In live mode, uses the network's faucet to fund the account (only available on Devnet, Testnet, and local networks).
   *
   * @param account - The account profile name to fund.
   * @param amount - The amount of APT (in octas) to fund.
   * @throws Error if the funding operation fails or if faucet is not available (e.g., Mainnet).
   */
  fundAccount(account: string, amount: number | bigint | string): void {
    if (this.isLiveMode) {
      if (!this.faucetUrl) {
        if (this.network === "Mainnet") {
          throw new Error(
            "fundAccount is not supported on Mainnet: no faucet exists",
          );
        } else if (this.network === "Testnet") {
          throw new Error(
            "fundAccount is not supported on Testnet: faucet requires web UI with Google authentication (https://aptos.dev/network/faucet)",
          );
        } else {
          throw new Error(
            `fundAccount is not supported on ${this.network}: no faucet URL configured`,
          );
        }
      }

      const accountAddress = this.getAccountAddress(account);

      const res = this.runAptos([
        "account",
        "fund-with-faucet",
        "--account",
        accountAddress,
        "--faucet-url",
        this.faucetUrl,
        "--amount",
        amount.toString(),
      ]);

      if (!res || !res.Result || !res.Result.startsWith("Added")) {
        throw new Error(
          `aptos fund-with-faucet failed: ${JSON.stringify(res)}`,
        );
      }
    } else {
      // prettier-ignore
      const res = this.runAptos([
        "move", "sim", "fund",
        "--session", this.getSessionPath(),
        "--account", account,
        "--amount", amount.toString(),
      ]);

      // FIXME: handle non-existent profile

      if (!res || res.Result !== "Success") {
        throw new Error(
          `aptos move sim fund failed: expected Result = Success, got ${JSON.stringify(res)}`,
        );
      }
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
    ];

    if (this.isLiveMode) {
      args.push("--assume-yes");
    } else {
      args.push("--session", this.getSessionPath());
    }

    args.push("--profile", options.sender, "--function-id", options.functionId);

    addTypeArgsAndArgs(args, options);
    addTransactionOptions(args, options);

    if (options.extraFlags) {
      args.push(...options.extraFlags);
    }

    const res = this.runAptos(args);

    this.maybeIncludeEvents(res, options.includeEvents);

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

    addNamedAddresses(compileArgs, options.namedAddresses);

    if (options.compileExtraFlags) {
      compileArgs.push(...options.compileExtraFlags);
    }

    this.runAptos(compileArgs);

    const packageName = getMovePackageNameFromManifest(options.packageDir);

    // prettier-ignore
    const runArgs = [
      "move", "run-script",
    ];

    if (this.isLiveMode) {
      runArgs.push("--assume-yes");
    } else {
      runArgs.push("--session", this.getSessionPath());
    }

    runArgs.push(
      "--profile",
      options.sender,
      "--compiled-script-path",
      join(
        options.packageDir,
        "build",
        packageName,
        "bytecode_scripts",
        options.scriptName + ".mv",
      ),
    );

    addTypeArgsAndArgs(runArgs, options);
    addTransactionOptions(runArgs, options);

    if (options.runExtraFlags) {
      runArgs.push(...options.runExtraFlags);
    }

    const res = this.runAptos(runArgs);

    this.maybeIncludeEvents(res, options.includeEvents);

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
    ];

    if (this.isLiveMode) {
      args.push("--assume-yes");
    } else {
      args.push("--session", this.getSessionPath());
    }

    args.push("--profile", options.sender, "--package-dir", options.packageDir);

    addNamedAddresses(args, options.namedAddresses);
    addPackageOptions(args, options);
    addTransactionOptions(args, options);

    if (options.extraFlags) {
      args.push(...options.extraFlags);
    }

    const res = this.runAptos(args);

    this.maybeIncludeEvents(res, options.includeEvents);

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
    ];

    if (!this.isLiveMode) {
      args.push("--session", this.getSessionPath());
    }

    args.push(
      "--profile",
      options.sender,
      "--package-dir",
      options.packageDir,
      "--address-name",
      options.packageAddressName,
    );

    addNamedAddresses(args, options.namedAddresses);
    addPackageOptions(args, options);
    addTransactionOptions(args, options);

    if (options.extraFlags) {
      args.push(...options.extraFlags);
    }

    const res = this.runAptos(args);

    // Normalize deployed_object_address to include 0x prefix
    if (res?.Result?.deployed_object_address) {
      const addr = res.Result.deployed_object_address;
      if (!addr.startsWith("0x")) {
        res.Result.deployed_object_address = "0x" + addr;
      }
    }

    this.maybeIncludeEvents(res, options.includeEvents);

    return res;
  }

  /**
   * Upgrades a code object.
   *
   * @returns The upgrade result as a JSON object
   * @throws Error if running into non-execution failures.
   */
  upgradeCodeObject(options: UpgradeCodeObjectOptions): any {
    // prettier-ignore
    const args = [
      "move", "upgrade-object",
      "--assume-yes",
    ];

    if (!this.isLiveMode) {
      args.push("--session", this.getSessionPath());
    }

    args.push(
      "--profile",
      options.sender,
      "--package-dir",
      options.packageDir,
      "--address-name",
      options.packageAddressName,
      "--object-address",
      options.objectAddress,
    );

    addNamedAddresses(args, options.namedAddresses);
    addPackageOptions(args, options);
    addTransactionOptions(args, options);

    if (options.extraFlags) {
      args.push(...options.extraFlags);
    }

    const res = this.runAptos(args);

    this.maybeIncludeEvents(res, options.includeEvents);

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
    ];

    if (!this.isLiveMode) {
      args.push("--session", this.getSessionPath());
    }

    args.push("--function-id", options.functionId);

    addTypeArgsAndArgs(args, options);

    if (options.extraFlags) {
      args.push(...options.extraFlags);
    }

    const res = this.runAptos(args);

    return res;
  }

  /**
   * Views a resource group.
   *
   * In simulation mode, queries the simulation session state.
   * In live mode, fetches resources from the network via REST API.
   *
   * @param account - The account address or profile name.
   * @param resourceGroup - The resource group type (e.g., "0x1::object::ObjectGroup").
   * @param derivedObjectAddress - Optional derived object address for computing the actual resource location.
   * @returns The resource group as a JSON object -- a map from resource type names
   * to individual resource objects.
   */
  viewResourceGroup(
    account: string,
    resourceGroup: string,
    derivedObjectAddress?: string,
  ): any {
    if (this.isLiveMode) {
      throw new Error(
        "viewResourceGroup is not supported in live mode. Use viewResource() to query individual resources within a group directly.",
      );
    } else {
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

      return this.runAptos(args);
    }
  }

  /**
   * Views a specific resource from an account.
   *
   * In simulation mode, queries the simulation session state.
   * In live mode, queries the network via REST API.
   *
   * @param account - The account address or profile name.
   * @param resource - The fully qualified resource type (e.g., "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>").
   * @returns The resource as a JSON object.
   */
  viewResource(account: string, resource: string): any {
    if (this.isLiveMode) {
      // Resolve profile name to address if needed
      let address = account;
      if (!account.startsWith("0x")) {
        address = this.getAccountAddress(account);
      }

      // URL-encode the resource type (handles angle brackets, colons, etc.)
      const encodedResource = encodeURIComponent(resource);
      const url = `${this.restUrl}/v1/accounts/${address}/resource/${encodedResource}`;

      const response = fetch(url);
      if (!response.ok) {
        // Return null result for 404 to match simulation mode behavior
        if (response.status === 404) {
          return { Result: null };
        }
        throw new Error(
          `Failed to fetch resource: ${response.status} ${response.statusText}`,
        );
      }

      // Wrap response to match simulation format: { Result: data }
      const resource_response = response.json() as { type: string; data: any };
      return { Result: resource_response.data };
    } else {
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

      return this.runAptos(args);
    }
  }

  /**
   * Gets the APT balance from the Fungible Store for a given account.
   * Uses the primary store derived from the account and the APT metadata address (0xA).
   *
   * @returns The APT balance as a bigint.
   */
  getAPTBalanceFungibleStore(account: string): bigint {
    if (this.isLiveMode) {
      // Resolve profile name to address if needed
      let address = account;
      if (!account.startsWith("0x")) {
        address = this.getAccountAddress(account);
      }

      // Compute primary fungible store address
      const storeAddress = computeDerivedObjectAddress(address, "0xA");

      // Fetch the FungibleStore resource directly
      const resourceType = encodeURIComponent(
        "0x1::fungible_asset::FungibleStore",
      );
      const url = `${this.restUrl}/v1/accounts/${storeAddress}/resource/${resourceType}`;
      const response = fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return BigInt(0);
        }
        throw new Error(
          `Failed to fetch FungibleStore: ${response.status} ${response.statusText}`,
        );
      }

      const resource = response.json() as { type: string; data: any };
      return BigInt(resource.data.balance);
    } else {
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
  }

  /**
   * Cleans up the harness by removing the temporary working directory.
   *
   * After calling this method, the harness instance becomes "poisoned" and any
   * subsequent method calls (except cleanup itself) will throw an error.
   */
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
    const res = this.runAptos(["config", "show-profiles"]);

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

  /**
   * If includeEvents is true and the transaction succeeded, fetches and attaches events to the result.
   */
  private maybeIncludeEvents(res: any, includeEvents?: boolean): void {
    if (includeEvents && res.Result?.success) {
      const events = this.fetchTransactionEvents(res.Result.transaction_hash);
      if (events !== undefined) {
        res.Result.events = events;
      }
    }
  }

  /**
   * Fetches events for a transaction.
   *
   * In simulation mode, reads from the events.json file in the latest transaction directory.
   * In live mode, fetches the transaction from the REST API.
   *
   * @param transactionHash - The transaction hash to fetch events for.
   * @returns The events array, or undefined if not available.
   */
  private fetchTransactionEvents(transactionHash: string): any[] | undefined {
    if (this.isLiveMode) {
      // Live mode: fetch from REST API
      const url = `${this.restUrl}/v1/transactions/by_hash/${transactionHash}`;
      const response = fetch(url);

      if (!response.ok) {
        console.warn(
          `Failed to fetch transaction events: ${response.status} ${response.statusText}`,
        );
        return undefined;
      }

      const txData = response.json() as { events?: any[] };
      return txData.events;
    } else {
      // Simulation mode: read from events.json in the latest transaction directory
      const sessionPath = this.getSessionPath();

      if (!existsSync(sessionPath)) {
        return undefined;
      }

      try {
        // Read config.json to get the transaction count
        const configPath = join(sessionPath, "config.json");
        if (!existsSync(configPath)) {
          return undefined;
        }

        const config = JSON.parse(readFileSync(configPath, "utf8"));
        const lastTxIndex = config.ops - 1;

        // Find the directory starting with "[{lastTxIndex}]"
        const files = readdirSync(sessionPath) as string[];
        const prefix = `[${lastTxIndex}]`;
        const txDir = files.find((f: string) => f.startsWith(prefix));

        if (!txDir) {
          return undefined;
        }

        const eventsPath = join(sessionPath, txDir, "events.json");
        if (!existsSync(eventsPath)) {
          return undefined;
        }

        const eventsContent = readFileSync(eventsPath, "utf8");
        const rawEvents = JSON.parse(eventsContent);

        // Transform simulation event format to match REST API format
        // Simulation format: { V2: { type_tag: "...", event_data: {...} } }
        // REST API format: { type: "...", data: {...} }
        if (Array.isArray(rawEvents)) {
          return rawEvents.map((event: any) => {
            if (event.V2) {
              return {
                type: event.V2.type_tag,
                data: event.V2.event_data,
              };
            }
            // Return as-is if already in expected format
            return event;
          });
        }

        return undefined;
      } catch (e) {
        console.warn(`Failed to read events: ${e}`);
        return undefined;
      }
    }
  }
}

export {
  Harness,
  type TransactionOptions,
  type FunctionCallOptions,
  type PackageOptions,
  type MoveRunOptions,
  type MoveRunScriptOptions,
  type ViewOptions,
  type PublishOptions,
  type DeployCodeObjectOptions,
  type UpgradeCodeObjectOptions,
};
