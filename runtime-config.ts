export function parsePaymentStatusPollIntervalSeconds(
  value: string | undefined,
): number | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  const seconds = Number(normalized);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      "PAYMENT_STATUS_POLL_INTERVAL must be a positive whole number of seconds.",
    );
  }

  return seconds;
}
