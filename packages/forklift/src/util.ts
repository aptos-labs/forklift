export function assertTxnSuccess(res: any): void {
  try {
    expect(res.Result.success).toBe(true);
  } catch (e) {
    throw new Error(
      `Expected successful transaction, got:\n${JSON.stringify(res, null, 2)}`,
    );
  }
}
