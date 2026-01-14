/**
 * Deploy or upgrade the TipJar contract.
 *
 * If codeAddress exists in config, upgrades the existing contract.
 * Otherwise, deploys a new contract.
 *
 * Usage:
 *   npm run deploy -- --account <account_name> [--live]
 *
 * Options:
 *   --account      Account name from credentials (required)
 *   --config       Config file path (default: config.json)
 *   --credentials  Credentials file path (default: ~/.tip-jar/credentials.json)
 *   --live         Actually deploy/upgrade (default: fork/dry-run mode)
 */

import { Harness } from "@aptos-labs/forklift";
import { parseArgs, requireArg } from "../args";
import {
  loadConfig,
  loadCredentials,
  getPrivateKey,
  saveConfig,
} from "../config";
import { deployPackage, upgradePackage } from "../workflows";

const args = parseArgs();
const accountName = requireArg(args, "account");
const configPath = args.config as string | undefined;
const credentialsPath = args.credentials as string | undefined;
const isLive = args.live === true;

const config = loadConfig(configPath);
const credentials = loadCredentials(credentialsPath);
const privateKey = getPrivateKey(credentials, accountName);

const isUpgrade = !!config.codeAddress;
const action = isUpgrade ? "Upgrading" : "Deploying";

console.log(`${action} TipJar contract...`);
console.log(`  Network: ${config.network}`);
console.log(`  Account: ${accountName}`);
if (isUpgrade) {
  console.log(`  Code address: ${config.codeAddress}`);
}
console.log(`  Mode: ${isLive ? "LIVE" : "fork (dry-run)"}`);

if (isLive) {
  console.log("\n⚠️  LIVE MODE - This will cost gas!\n");
}

// Create harness based on mode
const harness = isLive
  ? Harness.createLive(config.network)
  : Harness.createNetworkFork(config.network, credentials.apiKey ?? "");

try {
  // Register account with private key
  harness.init_cli_profile(accountName, privateKey);

  if (isUpgrade) {
    upgradePackage(harness, accountName, config.codeAddress!);
    console.log("\n✓ Upgraded successfully!");
    console.log(`  Code address: ${config.codeAddress}`);
  } else {
    const codeAddress = deployPackage(harness, accountName);
    console.log("\n✓ Deployed successfully!");
    console.log(`  Code address: ${codeAddress}`);

    // Update config with code address
    if (isLive) {
      config.codeAddress = codeAddress;
      saveConfig(config, configPath);
      console.log("\n✓ Updated config.json with code address");
    }
  }

  if (!isLive) {
    console.log(
      "\n(Dry-run mode - config not updated. Use --live to deploy for real.)",
    );
  }
} finally {
  harness.cleanup();
}
