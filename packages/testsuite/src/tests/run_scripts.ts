import { assertTxnSuccess, Harness } from "forklift";
import * as path from "path";

describe("publish, set message, and view message", () => {
  let harness: Harness = new Harness();

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

  it("set message via script", () => {
    const runRes = harness.runMoveScript({
      sender: "default",
      packageDir: path.join(__dirname, "../../move_packages/message"),
      scriptName: "script_hello_aptos",
      namedAddresses: {
        simple_message: "default",
      },
    });
    assertTxnSuccess(runRes);
  });

  it("view message", () => {
    const viewRes = harness.runViewFunction({
      functionId: `default::message::get_message`,
      args: [`address:default`],
    });
    expect(viewRes.Result[0]).toBe("Hello, Aptos!");
  });
});
