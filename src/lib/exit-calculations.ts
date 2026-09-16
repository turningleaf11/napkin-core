// Exit strategy calculations for offer-specific refinance and sale waterfalls.
// Mirrors the Multifamily Deal Calculator spreadsheet: Exit Strategy, P&L, Returns and IRR tabs.
import { PropertyInputs, OfferResult, calculateProjectedNOI, calculateProjectedEGI, calculateMemberDistribution, calculateMonthlyPayment } from './underwriting-calculations';

export interface OfferExitResult {
  // False when the refi year is 0 or after the sale year — the spreadsheet's "NA" refinance
  hasRefi: boolean;
  // False when refi and sale fall in the same year: returns are measured through the refinance,
  // exactly as the spreadsheet's IRR and Returns tabs do
  saleCountedInReturns: boolean;

  // Refinance
  refiYear: number;
  refiNOI: number;
  refiCapRate: number;
  refiAppraisedValue: number;
  refiNewLoanAmount: number;
  refiCosts: number;
  prepaymentPenalty: number;
  outstandingBalanceAtRefi: number;
  grossRefiProceeds: number;
  returnOfCapitalAtRefi: number;
  capitalAccountAfterRefi: number;
  principalReductionAtRefi: number;
  appreciationAtRefi: number;
  capitalTransactionFeeRefi: number;
  netProfitFromRefi: number;
  memberProfitRefi: number;
  managerProfitRefi: number;
  totalCashToMembersAtRefi: number;
  pctInvestmentReturnedAtRefi: number;

  // Sale
  saleYear: number;
  saleNOI: number;
  saleCapRate: number;
  salePrice: number;
  reservesReturned: number;
  sellingCosts: number;
  outstandingBalanceAtSale: number;
  totalEquity: number;
  returnOfCapitalAtSale: number;
  netProfitFromSale: number;
  principalReductionAtSale: number;
  principalReductionTotal: number;
  appreciationAtSale: number;
  capitalTransactionFeeSale: number;
  memberProfitSale: number;
  managerProfitSale: number;
  totalCashToMembersAtSale: number;

  // Member returns
  memberCashFlows: number[]; // Year 1..saleYear distributions to members
  memberCashFlowYear1: number;
  memberCOCYear1: number;
  totalProfitsFromAppreciation: number;
  totalCashToMembers: number; // ROI-style: operating cash flows + member profits (excludes return of capital)
  totalCashPaidToMembers: number; // Liquidity-style: all cash paid at refi + sale (includes return of capital)
  totalROI: number;
  irr: number;
  aar: number;
  avgCashOnCash: number;
}

// Calculate loan balance with custom terms at a given year
export function calculateLoanBalanceWithTerms(
  principal: number,
  annualRate: number,
  amortizationYears: number,
  yearsElapsed: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, amortizationYears);

  let balance = principal;
  const monthsElapsed = yearsElapsed * 12;

  for (let i = 0; i < monthsElapsed; i++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    balance -= principalPayment;
  }

  return Math.max(0, balance);
}

// The spreadsheet's XIRR calendar (IRR tab, column D): day 0 is 12/31/1979, then quarter-end dates
const XIRR_START = Date.UTC(1979, 11, 31);

function quarterEndInYears(year: number, quarter: number): number {
  // Day 0 of the following month is the last day of the quarter's final month
  const quarterEnd = Date.UTC(1979 + year, quarter * 3, 0);
  return (quarterEnd - XIRR_START) / 86_400_000 / 365;
}

interface DatedCashFlow {
  years: number;
  amount: number;
}

// Excel-style XIRR, solved by bisection. Returns a percentage.
export function calculateXIRR(cashFlows: DatedCashFlow[]): number {
  const npv = (rate: number) =>
    cashFlows.reduce((sum, cf) => sum + cf.amount / Math.pow(1 + rate, cf.years), 0);

  let low = -0.9999;
  let high = 10;
  const npvLow = npv(low);
  const npvHigh = npv(high);
  if (npvLow * npvHigh > 0) {
    // No sign change: returns are beyond the search range in one direction
    return npvHigh > 0 ? high * 100 : low * 100;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (npv(mid) * npvLow > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return ((low + high) / 2) * 100;
}

// Main function to calculate exit data for a specific offer
export function calculateOfferExitData(
  offer: OfferResult,
  inputs: PropertyInputs,
  offerInterestRate: number,
  offerAmortization: number
): OfferExitResult {
  const saleYear = Math.max(1, Math.round(inputs.saleAtYear));
  const refiYear = Math.round(inputs.refinanceAtYear);
  const hasRefi = refiYear >= 1 && refiYear <= saleYear;
  const saleCountedInReturns = !hasRefi || refiYear < saleYear;

  const capRateIncrease = inputs.exitCapRateIncreasePerYear ?? 0.1;
  const feePercent = (inputs.capitalTransactionFeePercent ?? 1) / 100;
  const memberShare = (inputs.memberProfitSharePercent ?? 70) / 100;
  const initialCapital = offer.totalCapitalRequired;

  // === REFINANCE CALCULATIONS ===

  let refiNOI = 0;
  let refiCapRate = 0;
  let refiAppraisedValue = 0;
  let refiNewLoanAmount = 0;
  let refiCosts = 0;
  let outstandingBalanceAtRefi = 0;
  let prepaymentPenalty = 0;
  let grossRefiProceeds = 0;
  let returnOfCapitalAtRefi = 0;
  let capitalAccountAfterRefi = initialCapital;
  let principalReductionAtRefi = 0;
  let netProfitFromRefi = 0;
  let appreciationAtRefi = 0;
  let capitalTransactionFeeRefi = 0;
  let memberProfitRefi = 0;
  let managerProfitRefi = 0;
  let totalCashToMembersAtRefi = 0;
  let pctInvestmentReturnedAtRefi = 0;

  if (hasRefi) {
    // Appraisal uses the refi year's operating NOI (N-1 years of growth)
    // at the exit cap rate plus the annual bump for every year held
    refiNOI = calculateProjectedNOI(inputs, refiYear - 1);
    refiCapRate = inputs.exitCapRate + capRateIncrease * refiYear;
    refiAppraisedValue = refiCapRate > 0 ? refiNOI / (refiCapRate / 100) : 0;

    refiNewLoanAmount = refiAppraisedValue * (inputs.refiLTV / 100);
    refiCosts = refiAppraisedValue * (inputs.refiCostsPercent / 100);

    // Outstanding balance at refinance (using offer's specific rate/amortization)
    outstandingBalanceAtRefi = calculateLoanBalanceWithTerms(
      offer.loanAmount,
      offerInterestRate,
      offerAmortization,
      refiYear
    );
    prepaymentPenalty = outstandingBalanceAtRefi * (inputs.prepaymentPenaltyPercent / 100);
    grossRefiProceeds = refiNewLoanAmount - refiCosts - prepaymentPenalty - outstandingBalanceAtRefi;

    // Capital account tracking
    returnOfCapitalAtRefi = Math.min(Math.max(0, grossRefiProceeds), initialCapital);
    capitalAccountAfterRefi = initialCapital - returnOfCapitalAtRefi;
    principalReductionAtRefi = offer.loanAmount - outstandingBalanceAtRefi;

    // Profit is only distributed once all member capital has been returned
    netProfitFromRefi = capitalAccountAfterRefi > 0 ? 0 : Math.max(0, grossRefiProceeds - returnOfCapitalAtRefi);

    // Realized appreciation at refi = Net Proceeds minus Principal Reduction (if positive)
    appreciationAtRefi = netProfitFromRefi > 0
      ? Math.max(0, netProfitFromRefi - principalReductionAtRefi)
      : 0;

    // Fee is a percent of the appraised value, capped at the profit, and due only once capital is returned
    capitalTransactionFeeRefi = capitalAccountAfterRefi === 0
      ? Math.min(feePercent * refiAppraisedValue, netProfitFromRefi)
      : 0;
    const profitAfterFeeRefi = netProfitFromRefi - capitalTransactionFeeRefi;
    memberProfitRefi = profitAfterFeeRefi * memberShare;
    managerProfitRefi = profitAfterFeeRefi * (1 - memberShare);

    totalCashToMembersAtRefi = returnOfCapitalAtRefi + memberProfitRefi;
    pctInvestmentReturnedAtRefi = initialCapital > 0 ? (returnOfCapitalAtRefi / initialCapital) * 100 : 0;
  }

  // === SALE CALCULATIONS ===

  // Sale uses the sale year's operating NOI (N-1 years of growth)
  const saleNOI = calculateProjectedNOI(inputs, saleYear - 1);
  const saleCapRate = inputs.exitCapRate + capRateIncrease * saleYear;
  const salePrice = saleCapRate > 0 ? saleNOI / (saleCapRate / 100) : 0;

  // Reserves returned
  const reservesReturned = inputs.operatingReserves * (inputs.reservesReturnedPercent / 100);

  // Selling costs
  const sellingCosts = salePrice * (inputs.sellingCostsPercent / 100);

  // Outstanding balance at sale: the refi loan after a refinance, otherwise the acquisition loan
  const outstandingBalanceAtSale = hasRefi
    ? calculateLoanBalanceWithTerms(refiNewLoanAmount, inputs.refiInterestRate, inputs.refiAmortization, saleYear - refiYear)
    : calculateLoanBalanceWithTerms(offer.loanAmount, offerInterestRate, offerAmortization, saleYear);

  // Total equity from sale
  const totalEquity = salePrice + reservesReturned - sellingCosts - outstandingBalanceAtSale;

  // Return remaining capital, limited to the equity the sale produces
  const returnOfCapitalAtSale = Math.min(capitalAccountAfterRefi, Math.max(0, totalEquity));

  // Net proceeds/profit from sale
  const netProfitFromSale = Math.max(0, totalEquity - returnOfCapitalAtSale);

  // Principal reduction on whichever loan is repaid at sale
  const principalReductionAtSale = (hasRefi ? refiNewLoanAmount : offer.loanAmount) - outstandingBalanceAtSale;

  // Principal reduction total (from original loan + refi loan paydown) - kept for reference
  const principalReductionTotal = principalReductionAtRefi + principalReductionAtSale;

  // Appreciation at sale = Net Profit minus Principal Reduction (if positive)
  const appreciationAtSale = netProfitFromSale > principalReductionAtSale
    ? netProfitFromSale - principalReductionAtSale
    : 0;

  // Fee is a percent of the sale price, charged only when the profit covers it
  const capitalTransactionFeeSale = netProfitFromSale > feePercent * salePrice ? feePercent * salePrice : 0;
  const profitAfterFeeSale = netProfitFromSale - capitalTransactionFeeSale;
  const memberProfitSale = profitAfterFeeSale * memberShare;
  const managerProfitSale = profitAfterFeeSale * (1 - memberShare);

  // Total cash to members at sale
  const totalCashToMembersAtSale = returnOfCapitalAtSale + memberProfitSale;

  // === OPERATING YEARS ===

  const refiAnnualDebtService = hasRefi
    ? calculateMonthlyPayment(refiNewLoanAmount, inputs.refiInterestRate, inputs.refiAmortization) * 12
    : 0;

  const memberCashFlows: number[] = [];
  const cocPercentages: number[] = [];

  for (let year = 1; year <= saleYear; year++) {
    // Year N grows from the base underwriting for N-1 years
    const yearNOI = calculateProjectedNOI(inputs, year - 1);
    const yearEGI = calculateProjectedEGI(inputs, year - 1);
    const debtService = hasRefi && year > refiYear ? refiAnnualDebtService : offer.annualDebtService;

    // Member's share of cash flow (after asset management fee)
    const memberCashFlow = calculateMemberDistribution(
      yearNOI - debtService,
      yearEGI,
      inputs.assetManagementFeePercent,
      inputs.memberProfitSharePercent
    ).memberCashFlow;
    memberCashFlows.push(memberCashFlow);

    // Cash-on-cash against the capital still invested at the start of the year.
    // Years with no capital left or no distribution are left out of the average.
    const beginningCapital = hasRefi && year > refiYear ? capitalAccountAfterRefi : initialCapital;
    if (beginningCapital > 0) {
      const yearCOC = (memberCashFlow / beginningCapital) * 100;
      if (yearCOC > 0) cocPercentages.push(yearCOC);
    }
  }

  // === MEMBER RETURNS ===

  const refiProceedsToMembers = hasRefi ? totalCashToMembersAtRefi : 0;
  const saleProceedsToMembers = saleCountedInReturns ? totalCashToMembersAtSale : 0;

  // Each year's distributions are paid quarterly; capital events land in the fourth quarter of their year
  const datedCashFlows: DatedCashFlow[] = [{ years: 0, amount: -initialCapital }];
  memberCashFlows.forEach((memberCashFlow, index) => {
    const year = index + 1;
    for (let quarter = 1; quarter <= 4; quarter++) {
      let amount = memberCashFlow / 4;
      if (quarter === 4 && hasRefi && year === refiYear) amount += refiProceedsToMembers;
      if (quarter === 4 && saleCountedInReturns && year === saleYear) amount += saleProceedsToMembers;
      datedCashFlows.push({ years: quarterEndInYears(year, quarter), amount });
    }
  });
  const irr = initialCapital > 0 ? calculateXIRR(datedCashFlows) : 0;

  const totalMemberOperatingCashFlow = memberCashFlows.reduce((sum, cf) => sum + cf, 0);
  const memberProfitSaleCounted = saleCountedInReturns ? memberProfitSale : 0;
  const totalProfitsFromAppreciation = memberProfitRefi + memberProfitSaleCounted;
  const totalCashToMembers = totalMemberOperatingCashFlow + totalProfitsFromAppreciation;
  const totalCashPaidToMembers = refiProceedsToMembers + saleProceedsToMembers;
  const totalROI = initialCapital > 0 ? (totalCashToMembers / initialCapital) * 100 : 0;

  // With a refinance, AAR equals IRR. Without one, it is total member return
  // (distributions + sale profit) per year held, over the capital invested.
  const aar = hasRefi
    ? irr
    : initialCapital > 0
      ? ((totalMemberOperatingCashFlow + memberProfitSale) / initialCapital / saleYear) * 100
      : 0;

  const avgCashOnCash = cocPercentages.length > 0
    ? cocPercentages.reduce((sum, coc) => sum + coc, 0) / cocPercentages.length
    : 0;

  const memberCashFlowYear1 = memberCashFlows[0] ?? 0;
  const memberCOCYear1 = initialCapital > 0 ? (memberCashFlowYear1 / initialCapital) * 100 : 0;

  return {
    hasRefi,
    saleCountedInReturns,

    // Refinance
    refiYear,
    refiNOI,
    refiCapRate,
    refiAppraisedValue,
    refiNewLoanAmount,
    refiCosts,
    prepaymentPenalty,
    outstandingBalanceAtRefi,
    grossRefiProceeds,
    returnOfCapitalAtRefi,
    capitalAccountAfterRefi,
    principalReductionAtRefi,
    appreciationAtRefi,
    capitalTransactionFeeRefi,
    netProfitFromRefi,
    memberProfitRefi,
    managerProfitRefi,
    totalCashToMembersAtRefi,
    pctInvestmentReturnedAtRefi,

    // Sale
    saleYear,
    saleNOI,
    saleCapRate,
    salePrice,
    reservesReturned,
    sellingCosts,
    outstandingBalanceAtSale,
    totalEquity,
    returnOfCapitalAtSale,
    netProfitFromSale,
    principalReductionAtSale,
    principalReductionTotal,
    appreciationAtSale,
    capitalTransactionFeeSale,
    memberProfitSale,
    managerProfitSale,
    totalCashToMembersAtSale,

    // Member returns
    memberCashFlows,
    memberCashFlowYear1,
    memberCOCYear1,
    totalProfitsFromAppreciation,
    totalCashToMembers,
    totalCashPaidToMembers,
    totalROI,
    irr,
    aar,
    avgCashOnCash,
  };
}
