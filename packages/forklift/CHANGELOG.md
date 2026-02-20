# Changelog

## 1.1.0

### New Features

- **`newBlock(options?)`** — Execute a new block metadata transaction in simulation mode, advancing the on-chain timestamp. Supports absolute timestamps (`timestampUsecs`) and relative offsets (`offsetUsecs`).
- **`advanceEpoch()`** — Advance to the next epoch in simulation mode. Automatically calculates the minimum timestamp needed to cross the epoch boundary.
- **`profileGas`** — New option on all transaction methods (`runMoveFunction`, `runMoveScript`, `publishPackage`, `deployCodeObject`, `upgradeCodeObject`). Pass a directory path to generate and save a gas profiling report (simulation only).

### Requirements

- Aptos CLI v8.1.0 or later (previously v7.14.2).

## 1.0.1

Initial public release.
