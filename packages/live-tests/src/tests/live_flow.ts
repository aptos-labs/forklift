import { assertTxnSuccess, Harness } from "forklift";
import * as path from "path";
import { LocalNode } from "../localNode";

describe("live mode: publish, set message, and view message", () => {
  let localNode: LocalNode;
  let harness: Harness;
  let sender: string;
  let address: string;

  const message = "Hello, Live Aptos!";

  afterAll(async () => {
    await localNode.stop();
    harness.cleanup();
  });

  it("spawn local node and initialize harness", async () => {
    localNode = new LocalNode({ showStdout: false });
    await localNode.run();
    harness = Harness.createLive("http://127.0.0.1:8080");

    sender = "default";
    address = harness.getAccountAddress(sender);
  });

  it("fund account via faucet", async () => {
    const response = await fetch(
      `http://127.0.0.1:8081/mint?amount=100000000&address=${address}`,
      {
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new Error(`Faucet failed: ${response.statusText}`);
    }
  });

  it("publish package", async () => {
    const packageDir = path.join(__dirname, "../../move_packages/message");
    const publishRes = harness.publishPackage({
      sender,
      packageDir,
      namedAddresses: {
        simple_message: address,
      },
    });
    assertTxnSuccess(publishRes);
  });

  it("set message", async () => {
    const runRes = harness.runMoveFunction({
      sender,
      functionId: `${address}::message::set_message`,
      args: [`string:${message}`],
    });
    assertTxnSuccess(runRes);
  });

  it("view message", async () => {
    const viewRes = harness.runViewFunction({
      functionId: `${address}::message::get_message`,
      args: [`address:${address}`],
    });
    expect(viewRes.Result[0]).toBe(message);
  });
});
