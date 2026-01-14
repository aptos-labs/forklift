/**
 * Withdraw all funds from a TipJar.
 *
 * Usage:
 *   npm run withdraw -- --jar <name|address> --account <account_name> [--live]
 *
 * Options:
 *   --jar          Jar name (from config) or address (required)
 *   --account      Account name from credentials (required)
 *   --config       Config file path (default: config.json)
 *   --credentials  Credentials file path (default: ~/.tip-jar/credentials.json)
 *   --live         Actually withdraw (default: fork/dry-run mode)
 */

import { Harness } from "@aptos-labs/forklift";
import { parseArgs, requireArg, formatApt } from "../args";
import {
  loadConfig,
  loadCredentials,
  getPrivateKey,
  resolveJarAddress,
} from "../config";
import { withdraw, getBalance } from "../workflows";

const args = parseArgs();
const jarNameOrAddress = requireArg(args, "jar");
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

console.log("Withdrawing from TipJar...");
console.log(`  Jar: ${jarNameOrAddress} (${jarAddress})`);
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

  const balance = getBalance(harness, config.codeAddress, jarAddress);
  console.log(`  Current balance: ${formatApt(balance)}`);

  withdraw(harness, config.codeAddress, accountName, jarAddress);

  console.log("\n✓ Withdrawn successfully!");
  console.log(`  Amount: ${formatApt(balance)}`);
} finally {
  harness.cleanup();
}
