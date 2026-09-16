// Stack Method: 1st-position loan + seller carry (2nd lien) + transactional funding, buyer brings $0.
import { PropertyInputs, formatCurrency, formatNumber } from './underwriting-calculations';
import { CriterionCheck, OfferSolverResult, solveMaxPrice } from './scenario-analysis';

function calculateMonthlyPayment(principal: number, annualRate: number, amortYears: number): number {
  if (principal <= 0 || amortYears <= 0) return 0;
  if (annualRate <= 0) return principal / (amortYears * 12);
  const r = annualRate / 100 / 12;
  const n = amortYears * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calculateLoanBalanceAtYear(principal: number, annualRate: number, amortYears: number, yearsElapsed: number): number {
  if (principal <= 0 || amortYears <= 0) return 0;
  if (yearsElapsed >= amortYears) return 0;
  if (annualRate <= 0) {
    const totalPayments = amortYears * 12;
    const paymentsMade = yearsElapsed * 12;
    return principal * (1 - paymentsMade / totalPayments);
  }
  const r = annualRate / 100 / 12;
  const n = amortYears * 12;
  const p = yearsElapsed * 12;
  return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, p)) / (Math.pow(1 + r, n) - 1);
}

// The price the Stack tab analyzes: the one entered there, else the asking price
export function stackPriceFor(inputs: PropertyInputs): number {
  return inputs.stackPurchasePrice || inputs.askingPrice || 500000;
}

export function calculateStackDeal(inputs: PropertyInputs, purchasePrice: number) {
  const {
    stackSellerFinancePct: sellerFinancePct,
    stackSellerClosingCostsPct: sellerClosingCostsPct,
    stackReCommissionPct: reCommissionPct,
    stackOutstandingLoan: outstandingLoan,
    stackLoanLtvPct: loanLtvPct,
    stackBuyerClosingCostsPct: buyerClosingCostsPct,
    stackOriginationFeePct: originationFeePct,
    stackTfFeePct: tfFeePct,
    stackFirstLienRate: firstLienRate,
    stackFirstLienAmort: firstLienAmort,
    stackSecondLienRate: secondLienRate,
    stackSecondLienAmort: secondLienAmort,
    stackUnits: units,
    stackAvgRentPerUnit: avgRentPerUnit,
    stackOccupancyPct: occupancyPct,
    stackPropMgmtPct: propMgmtPct,
    stackMaintenanceReservePct: maintenanceReservePct,
    stackInsuranceMo: insuranceMo,
    stackTaxesMo: taxesMo,
    stackUtilitiesMo: utilitiesMo,
    stackRefiYear: refiYear,
    stackSaleYear: saleYear,
    stackExitCapRate: exitCapRate,
    stackCapRateIncreasePerYear: capRateIncreasePerYear,
    stackRefiLTV: refiLTV,
    stackRefiRate: refiRate,
    stackRefiAmort: refiAmort,
    stackRefiCostsPct: refiCostsPct,
    stackSellingCostsPct: sellingCostsPct,
    stackPrepayPenaltyPct: prepayPenaltyPct,
    stackRentGrowthPct: rentGrowthPct,
  } = inputs;

  // === PRE-CLOSING ===
  const sellerFinanceAmt = purchasePrice * (sellerFinancePct / 100);
  const sellerClosingCosts = purchasePrice * (sellerClosingCostsPct / 100);
  const reCommission = purchasePrice * (reCommissionPct / 100);
  const sellerNetCash = purchasePrice - sellerFinanceAmt - outstandingLoan - sellerClosingCosts - reCommission;

  const loanAmount = purchasePrice * (loanLtvPct / 100);
  const downPayment = purchasePrice - loanAmount;
  const buyerClosingCosts = purchasePrice * (buyerClosingCostsPct / 100);
  const originationFee = loanAmount * (originationFeePct / 100);
  const buyerTotalCostToClose = downPayment + buyerClosingCosts + originationFee;

  const tfFundingAmount = buyerTotalCostToClose;
  const tfFee = tfFundingAmount * (tfFeePct / 100);
  const tfTotalPayback = tfFundingAmount + tfFee;

  const escrowTotalIn = loanAmount + tfFundingAmount;

  // === POST-CLOSING WATERFALL (correct order) ===
  let remaining = escrowTotalIn;
  const w1_payoffLoan = outstandingLoan;
  remaining -= w1_payoffLoan;
  const w2_sellerClosing = sellerClosingCosts;
  remaining -= w2_sellerClosing;
  const w3_reCommission = reCommission;
  remaining -= w3_reCommission;
  const w4_sellerNetCash = Math.max(sellerNetCash, 0);
  remaining -= w4_sellerNetCash;
  const w5_buyerClosing = buyerClosingCosts;
  remaining -= w5_buyerClosing;
  const w6_originationFee = originationFee;
  remaining -= w6_originationFee;
  const w7_tfPayback = tfTotalPayback;
  remaining -= w7_tfPayback;
  const buyerWalkAwayCash = remaining;

  // Property liens
  const firstLienAmt = loanAmount;
  const secondLienAmt = sellerFinanceAmt;
  const combinedLiens = firstLienAmt + secondLienAmt;
  const firstLienLtv = purchasePrice > 0 ? (firstLienAmt / purchasePrice) * 100 : 0;
  const secondLienLtv = purchasePrice > 0 ? (secondLienAmt / purchasePrice) * 100 : 0;
  const combinedLtv = purchasePrice > 0 ? (combinedLiens / purchasePrice) * 100 : 0;

  // === CASHFLOW ===
  const firstPmtMo = calculateMonthlyPayment(firstLienAmt, firstLienRate, firstLienAmort);
  const secondPmtMo = calculateMonthlyPayment(secondLienAmt, secondLienRate, secondLienAmort);
  const combinedPmtMo = firstPmtMo + secondPmtMo;

  const grossRentMo = units * avgRentPerUnit;
  const effectiveRentMo = grossRentMo * (occupancyPct / 100);
  const effectiveRentYr = effectiveRentMo * 12;

  const propMgmtMo = effectiveRentMo * (propMgmtPct / 100);
  const maintenanceMo = effectiveRentMo * (maintenanceReservePct / 100);
  const totalExpensesMo = propMgmtMo + maintenanceMo + insuranceMo + taxesMo + utilitiesMo;
  const totalExpensesYr = totalExpensesMo * 12;

  const noiMo = effectiveRentMo - totalExpensesMo;
  const noiYr = noiMo * 12;

  const dscr1st = firstPmtMo > 0 ? noiMo / firstPmtMo : 0;
  const dscrCombined = combinedPmtMo > 0 ? noiMo / combinedPmtMo : 0;

  const cashFlowMo = noiMo - combinedPmtMo;
  const cashFlowYr = cashFlowMo * 12;

  const expensesPct = effectiveRentYr > 0 ? (totalExpensesYr / effectiveRentYr) * 100 : 0;
  const grm = grossRentMo > 0 ? purchasePrice / (grossRentMo * 12) : 0;

  // === EXIT STRATEGY ===
  // Project NOI at refi year (Year 1 = no growth, Year N = N-1 years growth for operations)
  const noiAtRefi = noiYr * Math.pow(1 + rentGrowthPct / 100, Math.max(refiYear - 1, 0));
  // Appraised value uses end-of-year valuation: full N years growth
  const appraisedValueRefi = exitCapRate > 0 ? (noiYr * Math.pow(1 + rentGrowthPct / 100, refiYear)) / (exitCapRate / 100) : 0;

  const loan1BalanceAtRefi = calculateLoanBalanceAtYear(firstLienAmt, firstLienRate, firstLienAmort, refiYear);
  const loan2BalanceAtRefi = calculateLoanBalanceAtYear(secondLienAmt, secondLienRate, secondLienAmort, refiYear);
  const totalLienPayoff = loan1BalanceAtRefi + loan2BalanceAtRefi;

  const newRefiLoan = appraisedValueRefi * (refiLTV / 100);
  const refiCosts = newRefiLoan * (refiCostsPct / 100);
  const prepayPenalty = totalLienPayoff * (prepayPenaltyPct / 100);
  const netRefiProceeds = newRefiLoan - totalLienPayoff - refiCosts - prepayPenalty;

  // Refi monthly payment (new single loan replaces both liens)
  const refiPmtMo = calculateMonthlyPayment(newRefiLoan, refiRate, refiAmort);

  // Sale at sale year
  const yearsAfterRefi = saleYear - refiYear;
  const noiAtSale = noiYr * Math.pow(1 + rentGrowthPct / 100, Math.max(saleYear - 1, 0));
  const saleCapRate = exitCapRate + (capRateIncreasePerYear * saleYear);
  const salePrice = saleCapRate > 0 ? (noiYr * Math.pow(1 + rentGrowthPct / 100, saleYear)) / (saleCapRate / 100) : 0;
  const refiLoanBalanceAtSale = calculateLoanBalanceAtYear(newRefiLoan, refiRate, refiAmort, yearsAfterRefi);
  const sellingCosts = salePrice * (sellingCostsPct / 100);
  const netSaleProceeds = salePrice - refiLoanBalanceAtSale - sellingCosts;

  // Total cash from operations: pre-refi years use combined debt, post-refi years use refi debt
  let totalCashFromOps = 0;
  for (let yr = 1; yr <= saleYear; yr++) {
    const grownNOI = noiYr * Math.pow(1 + rentGrowthPct / 100, Math.max(yr - 1, 0));
    if (yr <= refiYear) {
      totalCashFromOps += grownNOI - (combinedPmtMo * 12);
    } else {
      totalCashFromOps += grownNOI - (refiPmtMo * 12);
    }
  }

  const totalReturn = totalCashFromOps + netRefiProceeds + netSaleProceeds;

  return {
    sellerFinanceAmt, sellerClosingCosts, reCommission, sellerNetCash,
    loanAmount, downPayment, buyerClosingCosts, originationFee, buyerTotalCostToClose,
    tfFundingAmount, tfFee, tfTotalPayback, escrowTotalIn,
    w1_payoffLoan, w2_sellerClosing, w3_reCommission, w4_sellerNetCash,
    w5_buyerClosing, w6_originationFee, w7_tfPayback, buyerWalkAwayCash,
    firstLienAmt, secondLienAmt, combinedLiens,
    firstLienLtv, secondLienLtv, combinedLtv,
    firstPmtMo, secondPmtMo, combinedPmtMo,
    grossRentMo, effectiveRentMo, effectiveRentYr,
    propMgmtMo, maintenanceMo, totalExpensesMo, totalExpensesYr,
    noiMo, noiYr, dscr1st, dscrCombined,
    cashFlowMo, cashFlowYr, expensesPct, grm,
    // Exit
    noiAtRefi, appraisedValueRefi, loan1BalanceAtRefi, loan2BalanceAtRefi, totalLienPayoff,
    newRefiLoan, refiCosts, prepayPenalty, netRefiProceeds, refiPmtMo,
    noiAtSale, saleCapRate, salePrice, refiLoanBalanceAtSale, sellingCosts, netSaleProceeds,
    totalCashFromOps, totalReturn,
  };
}

export type StackDeal = ReturnType<typeof calculateStackDeal>;

// ---- Deal Readiness ----
export interface StackReadinessMetric {
  check: CriterionCheck;
  name: string;
  value: number;
  formatted: string;
  target: string;
  pass: boolean;
  comment: string;
  whyItMatters: string;
  lookForInOM: string;
  whatToAdjust: string;
}

// Stack checks, with thresholds from the investment criteria in Settings
export function getStackReadiness(inputs: PropertyInputs, calc: StackDeal): StackReadinessMetric[] {
  const { minDSCR, maxGRM, stackMaxExpenseRatio, stackMaxCombinedLTV } = inputs;
  const metric = (
    check: Omit<CriterionCheck, 'passes'>,
    formatted: string,
    target: string,
    comment: string,
    whyItMatters: string,
    lookForInOM: string,
    whatToAdjust: string,
    strict = false
  ): StackReadinessMetric => {
    const passes = check.direction === 'min'
      ? (strict ? check.value > check.threshold : check.value >= check.threshold)
      : check.value <= check.threshold;
    return {
      check: { ...check, passes },
      name: check.label,
      value: check.value,
      formatted,
      target,
      pass: passes,
      comment,
      whyItMatters,
      lookForInOM,
      whatToAdjust,
    };
  };

  return [
    metric(
      { key: 'dscr1st', label: 'DSCR (1st Only)', value: calc.dscr1st, threshold: minDSCR, unit: 'x', direction: 'min' },
      `${formatNumber(calc.dscr1st, 2)}x`,
      `≥ ${minDSCR}x`,
      `Current: ${formatNumber(calc.dscr1st, 2)}x. Most lenders require ${minDSCR}x minimum on the 1st position loan.`,
      'Lenders use DSCR to ensure there\'s enough cash flow to cover the 1st position loan payment with a safety margin.',
      'Historical NOI trends, rent rolls, and occupancy rates to validate income projections.',
      'Reduce the 1st loan LTV %, negotiate a lower interest rate, or increase rents to boost NOI.',
    ),
    metric(
      { key: 'dscrCombined', label: 'DSCR (Combined)', value: calc.dscrCombined, threshold: minDSCR, unit: 'x', direction: 'min' },
      `${formatNumber(calc.dscrCombined, 2)}x`,
      `≥ ${minDSCR}x`,
      `Current: ${formatNumber(calc.dscrCombined, 2)}x. Income should cover both loans by at least ${minDSCR}x.`,
      'Stack deals carry two loans. Coverage on the combined payment is what keeps the property paying its way with $0 invested.',
      'Total debt obligations and verify projected rents against market comps.',
      'Increase seller carry % to reduce 1st lien size, negotiate lower seller note rate, or extend amortization on either lien.',
    ),
    metric(
      { key: 'cashFlow', label: 'Monthly Cashflow', value: calc.cashFlowMo, threshold: 0, unit: '$/mo', direction: 'min' },
      formatCurrency(calc.cashFlowMo),
      '> $0',
      `Current: ${formatCurrency(calc.cashFlowMo)}/mo. Negative cash flow requires out-of-pocket funding each month.`,
      'The entire Stack strategy depends on immediate positive cash flow since no capital was invested upfront.',
      'Verify actual expenses vs. pro forma. Check for deferred maintenance that could increase costs.',
      'Reduce expenses (negotiate management fees), increase occupancy, raise rents, or restructure debt terms.',
      true,
    ),
    metric(
      { key: 'grm', label: 'GRM', value: calc.grm, threshold: maxGRM, unit: 'x', direction: 'max' },
      formatNumber(calc.grm, 1),
      `≤ ${maxGRM}x`,
      `Current: ${formatNumber(calc.grm, 1)}x. Higher GRM means you're paying more per dollar of rent.`,
      'A lower GRM means the purchase price is more favorable relative to the gross rent the property generates.',
      'Compare GRM to similar properties in the submarket. Look at rent growth potential.',
      'Negotiate a lower purchase price or find opportunities to increase rents post-acquisition.',
    ),
    metric(
      { key: 'expenses', label: 'Expenses %', value: calc.expensesPct, threshold: stackMaxExpenseRatio, unit: '%', direction: 'max' },
      `${formatNumber(calc.expensesPct, 1)}%`,
      `≤ ${stackMaxExpenseRatio}%`,
      `Current: ${formatNumber(calc.expensesPct, 1)}%. Expense ratio above ${stackMaxExpenseRatio}% squeezes NOI and debt coverage. Price doesn't change it.`,
      'High expense ratios reduce the cash flow available for debt service and distributions in a Stack deal.',
      'Line-by-line expense breakdown. Compare to market averages. Check for one-time vs recurring costs.',
      'Reduce property management fee %, lower maintenance reserve if justified, or sub-meter utilities to tenants.',
    ),
    metric(
      { key: 'combinedLtv', label: 'Combined LTV', value: calc.combinedLtv, threshold: stackMaxCombinedLTV, unit: '%', direction: 'max' },
      `${formatNumber(calc.combinedLtv, 1)}%`,
      `≤ ${stackMaxCombinedLTV}%`,
      `Current: ${formatNumber(calc.combinedLtv, 1)}%. Over ${stackMaxCombinedLTV}% combined leverage increases refinance risk.`,
      'Very high combined LTV means you need significant appreciation to refinance out of both liens. Manageable if cash flow is strong.',
      'Market appreciation trends, planned improvements that add value, and comparable property valuations.',
      'Increase seller carry % (to reduce 1st lien), negotiate a lower purchase price, or plan value-add improvements to increase appraised value at refi.',
    ),
  ];
}

// Highest Stack purchase price at which every Stack check passes
export function solveMaxStackOffer(inputs: PropertyInputs): OfferSolverResult {
  const evaluate = (price: number) => {
    const checks = getStackReadiness(inputs, calculateStackDeal(inputs, price)).map((m) => m.check);
    return { checks, passes: checks.every((c) => c.passes) };
  };
  const solved = solveMaxPrice(evaluate, stackPriceFor(inputs));
  const atMax = calculateStackDeal(inputs, solved.maxPrice);
  return {
    maxOfferPrice: solved.maxPrice,
    meetsAllCriteria: solved.meetsAllCriteria,
    limitingCriteria: solved.limitingCriteria,
    checks: solved.checks,
    unbounded: solved.unbounded,
    totalCapitalRequired: 0,
    annualCashFlow: atMax.cashFlowYr,
  };
}

