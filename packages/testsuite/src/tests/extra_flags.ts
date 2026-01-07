import { Harness } from "forklift";
import * as path from "path";

/**
 * These tests verify that the `extraFlags` option correctly passes additional arguments
 * to the underlying Aptos CLI command.
 *
 * We test this by passing the `--version` flag, which causes the CLI to print version
 * information and exit successfully, instead of executing the requested command and
 * outputting the expected JSON result. This unexpected output format causes the harness
 * to throw a JSON parsing error, confirming that our flag was indeed received and processed.
 */
describe("Extra flags support", () => {
  const harness = Harness.createLocal();
  const sender = "alice";
  const packageDir = path.resolve(__dirname, "../../move_packages/message");

  beforeAll(() => {
    harness.init_cli_profile(sender);
    harness.fundAccount(sender, 100000000);
  });

  afterAll(() => {
    harness.cleanup();
  });

  it("should fail when passing --version to runMoveFunction", () => {
    expect(() => {
      harness.runMoveFunction({
        sender,
        functionId: "0x1::coin::transfer",
        args: ["address:0x1", "u64:100"],
        typeArgs: ["0x1::aptos_coin::AptosCoin"],
        extraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });

  it("should fail when passing --version to runMoveScript (compile phase)", () => {
    expect(() => {
      harness.runMoveScript({
        sender,
        packageDir,
        scriptName: "script_hello_aptos",
        namedAddresses: { simple_message: sender },
        compileExtraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });

  it("should fail when passing --version to runMoveScript (run phase)", () => {
    expect(() => {
      harness.runMoveScript({
        sender,
        packageDir,
        scriptName: "script_hello_aptos",
        namedAddresses: { simple_message: sender },
        runExtraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });

  it("should fail when passing --version to publishPackage", () => {
    expect(() => {
      harness.publishPackage({
        sender,
        packageDir,
        namedAddresses: { simple_message: sender },
        extraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });

  it("should fail when passing --version to runViewFunction", () => {
    expect(() => {
      harness.runViewFunction({
        functionId: "0x1::coin::balance",
        typeArgs: ["0x1::aptos_coin::AptosCoin"],
        args: [`address:${sender}`],
        extraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });

  it("should fail when passing --version to deployCodeObject", () => {
    expect(() => {
      harness.deployCodeObject({
        sender,
        packageDir,
        packageAddressName: "simple_message",
        namedAddresses: { simple_message: sender },
        extraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });

  it("should fail when passing --version to upgradeCodeObject", () => {
    expect(() => {
      harness.upgradeCodeObject({
        sender,
        packageDir,
        packageAddressName: "simple_message",
        objectAddress: "0x123", // Dummy address
        namedAddresses: { simple_message: sender },
        extraFlags: ["--version"],
      });
    }).toThrow("Failed to parse process output as JSON");
  });
});
