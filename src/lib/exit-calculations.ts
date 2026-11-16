// Exit strategy calculations for offer-specific refinance and sale waterfalls.
// Built from the Multifamily Deal Calculator spreadsheet (Exit Strategy, P&L, Returns and IRR tabs);
// see calculateOfferExitData for where it follows the cash instead.
import { PropertyInputs, OfferResult, calculateProjectedNOI, calculateProjectedEGI, calculateMemberDistribution, calculateMonthlyPayment, calculateAnnualDebtServiceForYear } from './underwriting-calculations';

export interface OfferExitResult {
  // False when the refi year is 0, or in or after the sale year
  hasRefi: boolean;
  // Always true: the sale always counts. Kept for screens written against earlier versions.
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
  // Cash members put in when the new loan doesn't cover the old one and the costs
  capitalAddedAtRefi: number;
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
  // Cash members put in when the sale doesn't clear the loan and the costs
  capitalAddedAtSale: number;
  // Member capital the sale never gives back
  capitalLost: number;
  netProfitFromSale: number;
  principalReductionAtSale: number;
  principalReductionTotal: number;
  appreciationAtSale: number;
  capitalTransactionFeeSale: number;
  memberProfitSale: number;
  managerProfitSale: number;
  totalCashToMembersAtSale: number;

  // Member returns
  memberCashFlows: number[]; // Year 1..saleYear cash to members; negative when they had to cover a losing year
  memberCashFlowYear1: number;
  memberCOCYear1: number;
  reservesUsed: number; // Operating reserves spent covering losing years
  capitalAddedFromOperations: number; // Cash members added in losing years once the reserves ran out
  memberCapitalAdded: number; // All cash members added after closing: losing years, a short refinance, a short sale
  totalCapitalInvested: number; // Capital at closing plus everything added later
  totalProfitsFromAppreciation: number;
  totalCashToMembers: number; // Member profit: every dollar back minus every dollar in
  totalCashPaidToMembers: number; // Net cash at the refinance and the sale (includes return of capital)
  totalROI: number;
  irr: number;
  aar: number;
  avgCashOnCash: number;
}

// Calculate loan balance with custom terms at a given year.
// Months within interestOnlyMonths pay interest only, so the balance doesn't move
// until the amortizing payment (over the remaining term) takes over.
export function calculateLoanBalanceWithTerms(
  principal: number,
  annualRate: number,
  amortizationYears: number,
  yearsElapsed: number,
  interestOnlyMonths: number = 0
): number {
  const monthlyRate = annualRate / 100 / 12;
  const amortizingPayment = calculateMonthlyPayment(principal, annualRate, amortizationYears, interestOnlyMonths);

  let balance = principal;
  const monthsElapsed = yearsElapsed * 12;

  for (let month = 1; month <= monthsElapsed; month++) {
    const interestPayment = balance * monthlyRate;
    if (month <= interestOnlyMonths) continue;
    const principalPayment = amortizingPayment - interestPayment;
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

// Main function to calculate exit data for a specific offer.
//
// The model follows the cash. It started as a copy of the Multifamily Deal Calculator
// spreadsheet (Exit Strategy, P&L, Returns and IRR tabs) and still matches it to the cent
// on a deal that never comes up short. It departs from the spreadsheet where the
// spreadsheet loses track of money:
//   - A year that loses money is paid for: first out of the operating reserves, then by
//     the members. (The spreadsheet shows the year as zero.)
//   - A refinance or sale that comes up short is money the members put in.
//   - Average cash-on-cash counts every year, against the capital actually put in.
//     (The spreadsheet averages only the years with a payout, each against whatever
//     capital is left after a refinance, which inflates it.)
//   - AAR is always total profit per year held. (The spreadsheet swaps in the IRR
//     whenever there is a refinance.)
//   - A refinance in the sale year is just the sale. (The spreadsheet drops the sale.)
//   - Every year's distributions count toward IRR. (The spreadsheet skips year 6.)
//
// balloonYears (seller financing only): the note is due in full at that year regardless
// of the stated refinance year, so a stated refi later than the balloon -- or no refi at
// all -- gets overridden by a refinance forced at the balloon year instead. A stated refi
// already at or before the balloon, or a sale at or before it, needs no override.
export function calculateOfferExitData(
  offer: OfferResult,
  inputs: PropertyInputs,
  offerInterestRate: number,
  offerAmortization: number,
  balloonYears?: number
): OfferExitResult {
  const saleYear = Math.max(1, Math.round(inputs.saleAtYear));
  const statedRefiYear = Math.round(inputs.refinanceAtYear);
  // A refinance only happens before the sale year; in the sale year the property is simply sold
  const hasStatedRefi = statedRefiYear >= 1 && statedRefiYear < saleYear;

  const balloon = balloonYears && balloonYears > 0 ? Math.round(balloonYears) : 0;
  const balloonForcesRefi = balloon > 0 && balloon < saleYear && !(hasStatedRefi && statedRefiYear <= balloon);

  const refiYear = balloonForcesRefi ? balloon : statedRefiYear;
  const hasRefi = balloonForcesRefi || hasStatedRefi;
  const saleCountedInReturns = true;

  const capRateIncrease = inputs.exitCapRateIncreasePerYear ?? 0.1;
  const feePercent = (inputs.capitalTransactionFeePercent ?? 1) / 100;
  const memberShare = (inputs.memberProfitSharePercent ?? 70) / 100;
  const initialCapital = offer.totalCapitalRequired;

  // === REFINANCE LOAN (sized first: the years after it pay its debt service) ===

  let refiNOI = 0;
  let refiCapRate = 0;
  let refiAppraisedValue = 0;
  let refiNewLoanAmount = 0;
  let refiCosts = 0;
  let outstandingBalanceAtRefi = 0;
  let prepaymentPenalty = 0;
  let grossRefiProceeds = 0;

  if (hasRefi) {
    // Appraisal uses the refi year's operating NOI (N-1 years of growth)
    // at the exit cap rate plus the annual bump for every year held
    refiNOI = calculateProjectedNOI(inputs, refiYear - 1);
    refiCapRate = inputs.exitCapRate + capRateIncrease * refiYear;
    refiAppraisedValue = refiCapRate > 0 ? refiNOI / (refiCapRate / 100) : 0;

    refiNewLoanAmount = Math.max(0, refiAppraisedValue * (inputs.refiLTV / 100));
    refiCosts = Math.max(0, refiAppraisedValue * (inputs.refiCostsPercent / 100));

    // Outstanding balance at refinance (using offer's specific rate/amortization)
    outstandingBalanceAtRefi = calculateLoanBalanceWithTerms(
      offer.loanAmount,
      offerInterestRate,
      offerAmortization,
      refiYear,
      inputs.interestOnlyMonths
    );
    prepaymentPenalty = outstandingBalanceAtRefi * (inputs.prepaymentPenaltyPercent / 100);
    grossRefiProceeds = refiNewLoanAmount - refiCosts - prepaymentPenalty - outstandingBalanceAtRefi;
  }

  const refiAnnualDebtService = hasRefi
    ? calculateMonthlyPayment(refiNewLoanAmount, inputs.refiInterestRate, inputs.refiAmortization) * 12
    : 0;

  // === OPERATING YEARS AND THE REFINANCE, IN ORDER ===

  let capitalAccount = initialCapital; // member capital still in the deal
  let reserveBalance = Math.max(0, inputs.operatingReserves);
  let reservesUsed = 0;
  let capitalAddedFromOperations = 0;

  let returnOfCapitalAtRefi = 0;
  let capitalAddedAtRefi = 0;
  let capitalAccountAfterRefi = initialCapital;
  let principalReductionAtRefi = 0;
  let netProfitFromRefi = 0;
  let appreciationAtRefi = 0;
  let capitalTransactionFeeRefi = 0;
  let memberProfitRefi = 0;
  let managerProfitRefi = 0;
  let totalCashToMembersAtRefi = 0;
  let pctInvestmentReturnedAtRefi = 0;

  const memberCashFlows: number[] = [];
  const cocPercentages: number[] = [];

  for (let year = 1; year <= saleYear; year++) {
    // Year N grows from the base underwriting for N-1 years
    const yearNOI = calculateProjectedNOI(inputs, year - 1);
    const yearEGI = calculateProjectedEGI(inputs, year - 1);
    const debtService = hasRefi && year > refiYear
      ? refiAnnualDebtService
      : calculateAnnualDebtServiceForYear(offer.loanAmount, offerInterestRate, offerAmortization, inputs.interestOnlyMonths, year);
    const cashFlow = yearNOI - debtService;
    const capitalAtStartOfYear = capitalAccount;

    let memberCashFlow: number;
    if (cashFlow < 0) {
      // The year loses money: the operating reserves cover it first, the members the rest
      const shortfall = -cashFlow;
      const fromReserves = Math.min(reserveBalance, shortfall);
      reserveBalance -= fromReserves;
      reservesUsed += fromReserves;
      const fromMembers = shortfall - fromReserves;
      capitalAddedFromOperations += fromMembers;
      capitalAccount += fromMembers;
      memberCashFlow = fromMembers > 0 ? -fromMembers : 0;
    } else {
      // Member's share of cash flow (after asset management fee)
      memberCashFlow = calculateMemberDistribution(
        cashFlow,
        yearEGI,
        inputs.assetManagementFeePercent,
        inputs.memberProfitSharePercent
      ).memberCashFlow;
    }
    memberCashFlows.push(memberCashFlow);

    // Cash-on-cash for every year, against the capital put in: the original investment,
    // or more once members have had to add to it. Capital handed back at a refinance
    // doesn't shrink the yardstick, so a small leftover balance can't inflate the return.
    const cocBase = Math.max(initialCapital, capitalAtStartOfYear);
    if (cocBase > 0) cocPercentages.push((memberCashFlow / cocBase) * 100);

    if (hasRefi && year === refiYear) {
      const capitalBeforeRefi = capitalAccount;
      if (grossRefiProceeds < 0) {
        // The new loan doesn't cover the old one and the costs: members make up the difference
        capitalAddedAtRefi = -grossRefiProceeds;
      } else {
        returnOfCapitalAtRefi = Math.min(grossRefiProceeds, capitalBeforeRefi);
      }
      capitalAccount = capitalBeforeRefi - returnOfCapitalAtRefi + capitalAddedAtRefi;
      capitalAccountAfterRefi = capitalAccount;
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

      totalCashToMembersAtRefi = returnOfCapitalAtRefi + memberProfitRefi - capitalAddedAtRefi;
      pctInvestmentReturnedAtRefi = capitalBeforeRefi > 0 ? (returnOfCapitalAtRefi / capitalBeforeRefi) * 100 : 0;
    }
  }

  // === SALE CALCULATIONS ===

  // Sale uses the sale year's operating NOI (N-1 years of growth)
  const saleNOI = calculateProjectedNOI(inputs, saleYear - 1);
  const saleCapRate = inputs.exitCapRate + capRateIncrease * saleYear;
  const salePrice = saleCapRate > 0 ? Math.max(0, saleNOI / (saleCapRate / 100)) : 0;

  // Reserves returned: a share of what is still in the operating account
  const reservesReturned = reserveBalance * (inputs.reservesReturnedPercent / 100);

  // Selling costs
  const sellingCosts = salePrice * (inputs.sellingCostsPercent / 100);

  // Outstanding balance at sale: the refi loan after a refinance, otherwise the acquisition loan
  const outstandingBalanceAtSale = hasRefi
    ? calculateLoanBalanceWithTerms(refiNewLoanAmount, inputs.refiInterestRate, inputs.refiAmortization, saleYear - refiYear)
    : calculateLoanBalanceWithTerms(offer.loanAmount, offerInterestRate, offerAmortization, saleYear, inputs.interestOnlyMonths);

  // Total equity from sale
  const totalEquity = salePrice + reservesReturned - sellingCosts - outstandingBalanceAtSale;

  // A sale that doesn't clear the loan and the costs is paid for by the members
  const capitalAddedAtSale = totalEquity < 0 ? -totalEquity : 0;

  // Return remaining capital, limited to the equity the sale produces
  const returnOfCapitalAtSale = Math.min(capitalAccount, Math.max(0, totalEquity));
  // Capital the sale never gives back
  const capitalLost = capitalAccount - returnOfCapitalAtSale + capitalAddedAtSale;

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

  // Net cash to members at sale (negative when they have to pay to close)
  const totalCashToMembersAtSale = returnOfCapitalAtSale + memberProfitSale - capitalAddedAtSale;

  // === MEMBER RETURNS ===

  const refiProceedsToMembers = hasRefi ? totalCashToMembersAtRefi : 0;
  const saleProceedsToMembers = totalCashToMembersAtSale;

  // Each year's cash is spread over four quarters; capital events land in the fourth quarter of their year
  const datedCashFlows: DatedCashFlow[] = [{ years: 0, amount: -initialCapital }];
  memberCashFlows.forEach((memberCashFlow, index) => {
    const year = index + 1;
    for (let quarter = 1; quarter <= 4; quarter++) {
      let amount = memberCashFlow / 4;
      if (quarter === 4 && hasRefi && year === refiYear) amount += refiProceedsToMembers;
      if (quarter === 4 && year === saleYear) amount += saleProceedsToMembers;
      datedCashFlows.push({ years: quarterEndInYears(year, quarter), amount });
    }
  });
  const irr = initialCapital > 0 ? calculateXIRR(datedCashFlows) : 0;

  // Everything the members put in, and their profit: every dollar back minus every dollar in
  const memberCapitalAdded = capitalAddedFromOperations + capitalAddedAtRefi + capitalAddedAtSale;
  const totalCapitalInvested = initialCapital + memberCapitalAdded;
  const totalMemberOperatingCashFlow = memberCashFlows.reduce((sum, cf) => sum + cf, 0);
  const totalProfitsFromAppreciation = memberProfitRefi + memberProfitSale;
  const totalCashPaidToMembers = refiProceedsToMembers + saleProceedsToMembers;
  // Member profit is every dollar back minus every dollar in: yearly cash (negative in years they
  // had to add money), plus net cash at the refinance and the sale, minus the capital at closing.
  // On a deal that returns all capital this is simply distributions plus profits.
  const totalCashToMembers = totalMemberOperatingCashFlow + totalCashPaidToMembers - initialCapital;
  const totalROI = totalCapitalInvested > 0 ? (totalCashToMembers / totalCapitalInvested) * 100 : 0;

  // Average annual return: total profit per year held, over everything invested
  const aar = totalROI / saleYear;

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
    capitalAddedAtRefi,
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
    capitalAddedAtSale,
    capitalLost,
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
    reservesUsed,
    capitalAddedFromOperations,
    memberCapitalAdded,
    totalCapitalInvested,
    totalProfitsFromAppreciation,
    totalCashToMembers,
    totalCashPaidToMembers,
    totalROI,
    irr,
    aar,
    avgCashOnCash,
  };
}
