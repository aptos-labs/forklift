import { assertTxnSuccess, Harness } from "@aptos-labs/forklift";
import * as path from "path";

describe("on-chain randomness", () => {
  let harness: Harness = Harness.createLocal();

  afterAll(() => {
    harness.cleanup();
  });

  it("should deploy randomness package", () => {
    const packageDir = path.join(__dirname, "../../move_packages/randomness");
    const publishRes = harness.publishPackage({
      sender: "default",
      packageDir,
      namedAddresses: {
        simple_randomness: "default",
      },
    });
    assertTxnSuccess(publishRes);
  });

  it("should flip coin using on-chain randomness", () => {
    const runRes = harness.runMoveFunction({
      sender: "default",
      functionId: `default::coin_flip::flip_coin`,
      args: [],
    });
    assertTxnSuccess(runRes);
  });

  it("should view the flip result", () => {
    const viewRes = harness.runViewFunction({
      functionId: `default::coin_flip::get_result`,
      args: [`address:default`],
    });
    // Result should be a boolean (true or false)
    expect(typeof viewRes.Result[0]).toBe("boolean");
  });
});
