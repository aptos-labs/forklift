/**
 * Initialize config file.
 *
 * Usage:
 *   npm run init -- --network <testnet|mainnet>
 */

import * as fs from "fs";
import { parseArgs } from "../args";
import { Config, saveConfig } from "../config";

const args = parseArgs();
const network = args.network ?? "devnet";

const validNetworks = ["devnet", "testnet", "mainnet"];
const isValidNetwork =
  validNetworks.includes(network) || network.startsWith("http");
if (!isValidNetwork) {
  throw new Error(
    `--network must be 'devnet', 'testnet', 'mainnet', or a custom URL (http(s)://...)`,
  );
}

const configPath = args.config ?? "config.json";

if (fs.existsSync(configPath)) {
  throw new Error(
    `Config file already exists: ${configPath}\nDelete it first if you want to reinitialize.`,
  );
}

const config: Config = {
  network,
  codeAddress: "",
  jars: {},
};

saveConfig(config, configPath);

console.log(`✓ Created ${configPath}`);
console.log(`  Network: ${network}`);
console.log("\nNext steps:");
console.log("  1. Create credentials.json (see credentials.template.json)");
console.log("  2. Run: npm run deploy -- --account <account_name>");
