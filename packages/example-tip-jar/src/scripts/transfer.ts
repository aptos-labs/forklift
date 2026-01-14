/**
 * Transfer ownership of a TipJar.
 *
 * Usage:
 *   npm run transfer -- --jar <name|address> --to <address> --account <account_name> [--live]
 *
 * Options:
 *   --jar          Jar name (from config) or address (required)
 *   --to           New owner address (required)
 *   --account      Account name from credentials (required)
 *   --config       Config file path (default: config.json)
 *   --credentials  Credentials file path (default: ~/.tip-jar/credentials.json)
 *   --live         Actually transfer (default: fork/dry-run mode)
 */

import { Harness } from "@aptos-labs/forklift";
import { parseArgs, requireArg } from "../args";
import {
  loadConfig,
  loadCredentials,
  getPrivateKey,
  resolveJarAddress,
} from "../config";
import { transfer } from "../workflows";

const args = parseArgs();
const jarNameOrAddress = requireArg(args, "jar");
const newOwner = requireArg(args, "to");
const accountName = requireArg(args, "account");
const configPath = args.config as string | undefined;
const credentialsPath = args.credentials as string | undefined;
const isLive = args.live === true;

const config = loadConfig(configPath);
const credentials = loadCredentials(credentialsPath);
const privateKey = getPrivateKey(credentials, accountName);
const jarAddress = resolveJarAddress(config, jarNameOrAddress);

if (!config.codeAddress) {
  throw new Error("No codeAddress in config. Run deploy first.");
}

console.log("Transferring TipJar ownership...");
console.log(`  Jar: ${jarNameOrAddress} (${jarAddress})`);
console.log(`  New owner: ${newOwner}`);
console.log(`  Network: ${config.network}`);
console.log(`  Account: ${accountName}`);
console.log(`  Mode: ${isLive ? "LIVE" : "fork (dry-run)"}`);

if (isLive) {
  console.log("\n⚠️  LIVE MODE - This will cost gas!\n");
}

const harness = isLive
  ? Harness.createLive(config.network)
  : Harness.createNetworkFork(config.network, credentials.apiKey ?? "");

try {
  harness.init_cli_profile(accountName, privateKey);

  transfer(harness, config.codeAddress, accountName, jarAddress, newOwner);

  console.log("\n✓ Transferred successfully!");
  console.log(`  New owner: ${newOwner}`);
} finally {
  harness.cleanup();
}
