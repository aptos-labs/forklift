import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "fs";
import * as path from "path";
import { tmpdir } from "os";

const MESSAGE_PACKAGE_DIR = path.join(__dirname, "../../move_packages/message");

function makeTempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "forklift-gas-test-"));
}

describe("gas profiler", () => {
  let harness: Harness;
  let outputDir: string;

  beforeEach(() => {
    harness = Harness.createLocal();
    outputDir = makeTempDir();
  });

  afterEach(() => {
    harness.cleanup();
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("should generate gas report for runMoveFunction and remove it from session", () => {
    const reportDir = path.join(outputDir, "transfer-report");

    const res = harness.runMoveFunction({
      sender: "default",
      functionId: "0x1::aptos_account::transfer",
      args: ["address:default", "u64:100"],
      profileGas: reportDir,
    });

    assertTxnSuccess(res);
    expect(existsSync(path.join(reportDir, "index.html"))).toBe(true);

    const sessionPath = harness.getSessionPath();
    const files = readdirSync(sessionPath) as string[];
    for (const f of files) {
      expect(existsSync(path.join(sessionPath, f, "gas-report"))).toBe(false);
    }
  });

  it("should generate gas report for publishPackage", () => {
    const reportDir = path.join(outputDir, "publish-report");

    const res = harness.publishPackage({
      sender: "default",
      packageDir: MESSAGE_PACKAGE_DIR,
      namedAddresses: { simple_message: "default" },
      profileGas: reportDir,
    });

    assertTxnSuccess(res);
    expect(existsSync(path.join(reportDir, "index.html"))).toBe(true);
  });

  it("should generate gas report for runMoveScript", () => {
    harness.publishPackage({
      sender: "default",
      packageDir: MESSAGE_PACKAGE_DIR,
      namedAddresses: { simple_message: "default" },
    });

    const reportDir = path.join(outputDir, "script-report");

    const res = harness.runMoveScript({
      sender: "default",
      packageDir: MESSAGE_PACKAGE_DIR,
      scriptName: "script_hello_aptos",
      namedAddresses: { simple_message: "default" },
      profileGas: reportDir,
    });

    assertTxnSuccess(res);
    expect(existsSync(path.join(reportDir, "index.html"))).toBe(true);
  });

  it("should generate gas report for deployCodeObject", () => {
    const reportDir = path.join(outputDir, "deploy-report");

    const res = harness.deployCodeObject({
      sender: "default",
      packageDir: MESSAGE_PACKAGE_DIR,
      packageAddressName: "simple_message",
      profileGas: reportDir,
    });

    assertTxnSuccess(res);
    expect(existsSync(path.join(reportDir, "index.html"))).toBe(true);
  });

  it("should generate gas report for upgradeCodeObject", () => {
    const deployRes = harness.deployCodeObject({
      sender: "default",
      packageDir: MESSAGE_PACKAGE_DIR,
      packageAddressName: "simple_message",
    });
    assertTxnSuccess(deployRes);

    const reportDir = path.join(outputDir, "upgrade-report");

    const res = harness.upgradeCodeObject({
      sender: "default",
      packageDir: MESSAGE_PACKAGE_DIR,
      packageAddressName: "simple_message",
      objectAddress: deployRes.Result.deployed_object_address,
      profileGas: reportDir,
    });

    assertTxnSuccess(res);
    expect(existsSync(path.join(reportDir, "index.html"))).toBe(true);
  });

  it("should throw in live mode", () => {
    const liveHarness = Harness.createLive("testnet");
    try {
      expect(() => {
        liveHarness.runMoveFunction({
          sender: "default",
          functionId: "0x1::aptos_account::transfer",
          args: ["address:default", "u64:100"],
          profileGas: path.join(outputDir, "should-not-exist"),
        });
      }).toThrow("only available in simulation mode");
    } finally {
      liveHarness.cleanup();
    }
  });
});
