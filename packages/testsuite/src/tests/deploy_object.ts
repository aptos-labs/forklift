import { assertTxnSuccess, Harness } from "forklift";
import * as path from "path";

// FIXME: Need new version of Aptos CLI. Reenable once that gets released.
describe.skip("code object", () => {
  const harness = Harness.createLocal();
  const sender = "alice";
  let objectAddress: string;

  afterAll(() => {
    harness.cleanup();
  });

  it("should publish message package and verify registry", () => {
    harness.init_cli_profile(sender);
    harness.fundAccount(sender, 100000000);

    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    const res = harness.deployCodeObject({
      sender: sender,
      packageDir,
      packageAddressName: "simple_message",
    });
    assertTxnSuccess(res);
    objectAddress = res.Result.deployed_object_address;
    expect(objectAddress).toBeDefined();

    const registry = harness.viewResource(
      objectAddress,
      "0x1::code::PackageRegistry",
    );
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("0");
  });

  it("should upgrade code object and verify upgrade number is incremented", () => {
    const res = harness.upgradeCodeObject({
      sender: sender,
      packageDir: path.resolve(__dirname, "../../move_packages/message"),
      packageAddressName: "simple_message",
      objectAddress: objectAddress,
    });
    assertTxnSuccess(res);

    const registry = harness.viewResource(
      objectAddress,
      "0x1::code::PackageRegistry",
    );
    const packageMetadata = registry.Result.packages.find(
      (pkg: any) => pkg.name === "SimpleMessage",
    );
    expect(packageMetadata).toBeDefined();
    expect(packageMetadata.upgrade_number).toBe("1");
  });
});
