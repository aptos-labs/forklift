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
    harness = Harness.createLive("local");

    sender = "default";
    address = harness.getAccountAddress(sender);
  });

  it("fund account via faucet", () => {
    harness.fundAccount(sender, 100000000);
  });

  it("get APT balance via fungible store", () => {
    const balance = harness.getAPTBalanceFungibleStore(sender);
    // After funding with 100000000 octas and spending some on gas, balance should be positive
    expect(balance).toBe(BigInt(100000000));
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

  it("view resource", () => {
    const resource = harness.viewResource(
      address,
      `${address}::message::MessageHolder`,
    );
    expect(resource.data.message).toBe(message);
  });
});
