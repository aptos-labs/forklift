import { assertTxnSuccess, Harness } from "forklift";
import * as path from "path";

describe("publish, set message, and view message", () => {
  let harness: Harness = Harness.createLocal();

  afterAll(() => {
    harness.cleanup();
  });

  it("publish package", () => {
    const packageDir = path.join(__dirname, "../../move_packages/message");
    const publishRes = harness.publishPackage({
      sender: "default",
      packageDir,
      namedAddresses: {
        simple_message: "default",
      },
    });
    assertTxnSuccess(publishRes);
  });

  const message = "Hello, Aptos!";
  it("set message", () => {
    const runRes = harness.runMoveFunction({
      sender: "default",
      functionId: `default::message::set_message`,
      args: [`string:${message}`],
    });
    assertTxnSuccess(runRes);
  });

  it("view message", () => {
    const viewRes = harness.runViewFunction({
      functionId: `default::message::get_message`,
      args: [`address:default`],
    });
    expect(viewRes.Result[0]).toBe(message);
  });
});
