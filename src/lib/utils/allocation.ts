export function allocatePayment(params: {
  amount: number;
  memberRate: number;
  existingCredit: number;
}): {
  monthsCovered: number;
  creditUsed: number;
  creditRemainder: number;
} {
  const { amount, memberRate, existingCredit } = params;

  if (memberRate <= 0) {
    return {
      monthsCovered: 0,
      creditUsed: 0,
      creditRemainder: amount + existingCredit,
    };
  }

  const totalAvailable = amount + existingCredit;
  const monthsCovered = Math.floor(totalAvailable / memberRate);
  const creditRemainder = totalAvailable % memberRate;
  const creditUsed = Math.min(
    existingCredit,
    amount + existingCredit - creditRemainder
  );

  return { monthsCovered, creditUsed, creditRemainder };
}

