// Rule 1 is immutable: one-time 10% penalty, then 21% interest, ceiling to kobo.
export const DEMAND_CALCULATION_VERSION=1 as const;
const moneyPattern=/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
export function principalKobo(value:string):bigint {
  const input=value.trim();
  if(input.length>300||!moneyPattern.test(input))throw new Error('Enter outstanding principal as a non-negative amount with at most two decimal places, for example 1,000.00.');
  const [whole,fraction='']=input.replaceAll(',','').split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function formatKobo(value:bigint):string {
  return `${(value/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${(value%100n).toString().padStart(2,'0')}`;
}
export function calculateDemand(principal:string) {
  const p=principalKobo(principal);
  const penalty=(p*10n+99n)/100n;
  const interest=((p+penalty)*21n+99n)/100n;
  return {principal:formatKobo(p),penalty:formatKobo(penalty),interest:formatKobo(interest),total:formatKobo(p+penalty+interest)};
}
