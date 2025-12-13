import { assertTxnSuccess, TestHarness } from "forklift";
import * as path from "path";

// FIXME: Need new version of Aptos CLI. Reenable once that gets released.
describe.skip("code object", () => {
  const harness = new TestHarness();
  const profileName = "alice";
  let objectAddress: string;

  afterAll(() => {
    harness.cleanup();
  });

  it("should publish message package and verify registry", () => {
    harness.init_cli_profile(profileName);
    harness.fundAccount(profileName, 100000000);

    const packageDir = path.resolve(__dirname, "../../move_packages/message");

    const res = harness.deployCodeObject({
      profile: profileName,
      packageDir,
      packageAddressName: "simple_message",
      namedAddresses: {
        simple_message: profileName,
      },
    });
    assertTxnSuccess(res);
    objectAddress = res.Result.object_address;
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
      profile: profileName,
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
