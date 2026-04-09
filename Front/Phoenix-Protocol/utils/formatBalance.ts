/**
 * Format balance for display across the app.
 * 
 * - "detail" mode: shows decimals ticking up (for mining widget)
 * - "compact" mode: clean integers, abbreviated for large numbers (everywhere else)
 */

export function formatBalanceDetail(balance: number): { whole: string; decimal: string } {
  const whole = Math.floor(balance);
  const dec = ((balance - whole) * 100) | 0;           // 2 digits
  return {
    whole: whole.toLocaleString('en-US'),
    decimal: String(dec).padStart(2, '0'),
  };
}

export function formatBalanceCompact(balance: number): string {
  if (balance >= 1_000_000_000_000) return (balance / 1_000_000_000_000).toFixed(1) + 'T';
  if (balance >= 1_000_000_000)     return (balance / 1_000_000_000).toFixed(1) + 'B';
  if (balance >= 1_000_000)         return (balance / 1_000_000).toFixed(1) + 'M';
  if (balance >= 10_000)            return (balance / 1_000).toFixed(1) + 'K';
  if (balance >= 1_000)             return Math.floor(balance).toLocaleString('en-US');
  return Math.floor(balance).toLocaleString('en-US');
}
