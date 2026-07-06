import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Harness } from "@aptos-labs/forklift";

function createFakeMovementCli(
  dir: string,
  logPath: string,
  version = "9.4.0",
  supportsSimulationSessions = true,
): string {
  const cliPath = join(dir, "movement");
  writeFileSync(
    cliPath,
    `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
if (args[0] === "--version") {
  console.log("movement ${version}");
  process.exit(0);
}
fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(args) + "\\n");
if (!${JSON.stringify(supportsSimulationSessions)} && args.slice(0, 3).join(" ") === "move sim init") {
  console.error("unrecognized subcommand sim");
  process.exit(2);
}
if (args.slice(0, 3).join(" ") === "move sim init") {
  console.log(JSON.stringify({ Result: "Success" }, null, 2));
  process.exit(0);
}
if (args.slice(0, 3).join(" ") === "move sim fund") {
  console.log(JSON.stringify({ Result: "Success" }, null, 2));
  process.exit(0);
}
console.error("unexpected fake movement CLI command: " + args.join(" "));
process.exit(1);
`,
  );
  chmodSync(cliPath, 0o755);
  return cliPath;
}

describe("Movement network defaults", () => {
  let tempDir: string;
  let logPath: string;
  let previousCliBinary: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "forklift-movement-test-"));
    logPath = join(tempDir, "cli.log");
    previousCliBinary = process.env.FORKLIFT_CLI_BINARY;
    process.env.FORKLIFT_CLI_BINARY = createFakeMovementCli(tempDir, logPath);
  });

  afterEach(() => {
    if (previousCliBinary === undefined) {
      delete process.env.FORKLIFT_CLI_BINARY;
    } else {
      process.env.FORKLIFT_CLI_BINARY = previousCliBinary;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("uses Movement mainnet for live mainnet profiles", () => {
    const harness = Harness.createLive("mainnet");
    const config = readFileSync(
      join(harness.getWorkingDir(), ".aptos", "config.yaml"),
      "utf8",
    );

    expect(config).toContain("network: Mainnet");
    expect(config).toContain("rest_url: https://mainnet.movementnetwork.xyz");

    harness.cleanup();
  });

  it("uses Movement testnet for live testnet profiles", () => {
    const harness = Harness.createLive("testnet");
    const config = readFileSync(
      join(harness.getWorkingDir(), ".aptos", "config.yaml"),
      "utf8",
    );

    expect(config).toContain("network: Testnet");
    expect(config).toContain("rest_url: https://testnet.movementnetwork.xyz");

    harness.cleanup();
  });

  it("does not require transaction simulation sessions for live profiles", () => {
    process.env.FORKLIFT_CLI_BINARY = createFakeMovementCli(
      tempDir,
      logPath,
      "7.4.0",
      false,
    );

    const harness = Harness.createLive("mainnet");
    const config = readFileSync(
      join(harness.getWorkingDir(), ".aptos", "config.yaml"),
      "utf8",
    );

    expect(config).toContain("rest_url: https://mainnet.movementnetwork.xyz");

    harness.cleanup();
  });

  it("passes Movement REST URLs to network fork initialization", () => {
    const harness = Harness.createNetworkFork("testnet", "fake-api-key", 123);
    const commands = readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line): string[] => JSON.parse(line));
    const initCommand = commands.find(
      (args) =>
        args[0] === "move" &&
        args[1] === "sim" &&
        args[2] === "init" &&
        args.includes("--path"),
    );

    expect(initCommand).toBeDefined();
    const initArgs = initCommand ?? [];
    expect(initArgs).toContain("--network");
    expect(initArgs).toContain("https://testnet.movementnetwork.xyz");
    expect(initArgs).toContain("--network-version");
    expect(initArgs).toContain("123");

    harness.cleanup();
  });
});
