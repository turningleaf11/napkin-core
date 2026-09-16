// Scenario readiness and the Offer Price Solver.
// Both run on the same numbers the scenario cards show: calculateOfferAtPrice + calculateOfferExitData.
import {
  PropertyInputs,
  OfferResult,
  DealReadinessMetric,
  calculateOfferAtPrice,
  calculateEffectiveGrossIncome,
  calculateOperatingExpenses,
  calculateFairMarketValue,
  formatPercent,
  formatNumber,
  formatCurrency,
} from './underwriting-calculations';
import { OfferExitResult, calculateOfferExitData } from './exit-calculations';

export type SolverScenario = 'dscr' | 'seller';

// One of the investment criteria, checked at a specific price
export interface CriterionCheck {
  key: string;
  label: string;
  value: number;
  threshold: number;
  unit: 'x' | '%' | '$/mo';
  direction: 'min' | 'max';
  passes: boolean;
}

export interface OfferSolverResult {
  maxOfferPrice: number;
  meetsAllCriteria: boolean;
  // The criterion that fails first just above the max price (or, with no viable price, the ones that never pass)
  limitingCriteria: CriterionCheck[];
  // Every criterion at the max price
  checks: CriterionCheck[];
  // True when the criteria still passed at the highest price searched
  unbounded: boolean;
  totalCapitalRequired: number;
  annualCashFlow: number;
}

export function formatCriterionValue(check: Pick<CriterionCheck, 'unit'>, value: number): string {
  if (check.unit === 'x') return `${formatNumber(value, 2)}x`;
  if (check.unit === '$/mo') return `${formatCurrency(value)}/mo`;
  return formatPercent(value);
}

export function describeCriterion(check: CriterionCheck): string {
  return `${check.label} ${check.direction === 'min' ? '≥' : '≤'} ${formatCriterionValue(check, check.threshold)}`;
}

function scenarioTerms(inputs: PropertyInputs, scenario: SolverScenario) {
  return scenario === 'seller'
    ? { rate: inputs.sellerFinanceRate, amortization: inputs.sellerFinanceAmortization }
    : { rate: inputs.interestRate, amortization: inputs.amortizationYears };
}

export interface ScenarioAnalysis {
  offer: OfferResult;
  exit: OfferExitResult;
  checks: CriterionCheck[];
  passes: boolean;
}

// The six investment criteria from Settings, checked at one price
export function analyzeOfferAtPrice(
  inputs: PropertyInputs,
  price: number,
  scenario: SolverScenario
): ScenarioAnalysis {
  const offer = calculateOfferAtPrice(inputs, price, scenario);
  const { rate, amortization } = scenarioTerms(inputs, scenario);
  const exit = calculateOfferExitData(offer, inputs, rate, amortization);
  const cashFlowPerDoor = inputs.units > 0 ? offer.cashFlow / inputs.units / 12 : 0;
  // With no debt there is nothing to cover
  const dscrPasses = offer.annualDebtService <= 0 || offer.dscr >= inputs.minDSCR;

  const checks: CriterionCheck[] = [
    { key: 'dscr', label: 'DSCR', value: offer.dscr, threshold: inputs.minDSCR, unit: 'x', direction: 'min', passes: dscrPasses },
    { key: 'coc', label: 'Avg Cash on Cash', value: exit.avgCashOnCash, threshold: inputs.minCashOnCash, unit: '%', direction: 'min', passes: exit.avgCashOnCash >= inputs.minCashOnCash },
    { key: 'irr', label: 'IRR', value: exit.irr, threshold: inputs.minIRR, unit: '%', direction: 'min', passes: exit.irr >= inputs.minIRR },
    { key: 'aar', label: 'AAR', value: exit.aar, threshold: inputs.minAAR, unit: '%', direction: 'min', passes: exit.aar >= inputs.minAAR },
    { key: 'cashFlowPerDoor', label: 'Cash Flow/Door', value: cashFlowPerDoor, threshold: inputs.minCashFlowPerDoor, unit: '$/mo', direction: 'min', passes: cashFlowPerDoor >= inputs.minCashFlowPerDoor },
  ];
  // Capital returned only applies when the plan includes a refinance
  if (exit.hasRefi) {
    checks.push({
      key: 'capitalReturned',
      label: 'Capital Returned',
      value: exit.pctInvestmentReturnedAtRefi,
      threshold: inputs.minCapitalReturned,
      unit: '%',
      direction: 'min',
      passes: exit.pctInvestmentReturnedAtRefi >= inputs.minCapitalReturned,
    });
  }

  return { offer, exit, checks, passes: checks.every((c) => c.passes) };
}

// Highest price at which every criterion passes, found on a grid and refined by bisection.
// Works for any price → checks function, so the Stack Method solver reuses it.
export function solveMaxPrice(
  evaluate: (price: number) => { checks: CriterionCheck[]; passes: boolean },
  startingPrice: number
): { maxPrice: number; meetsAllCriteria: boolean; unbounded: boolean; checks: CriterionCheck[]; limitingCriteria: CriterionCheck[] } {
  // Grow the search range until the criteria fail
  let high = Math.max(startingPrice, 100_000);
  let doublings = 0;
  while (evaluate(high).passes && doublings < 12) {
    high *= 2;
    doublings++;
  }
  const highResult = evaluate(high);
  if (highResult.passes) {
    return { maxPrice: high, meetsAllCriteria: true, unbounded: true, checks: highResult.checks, limitingCriteria: [] };
  }

  // Walk down the grid to the highest passing price. Criteria aren't guaranteed to be
  // monotone in price, so this doesn't assume every price below the answer passes.
  const gridSteps = 50;
  const stepSize = high / gridSteps;
  let passing = -1;
  for (let i = gridSteps - 1; i >= 1; i--) {
    if (evaluate(stepSize * i).passes) {
      passing = stepSize * i;
      break;
    }
  }

  if (passing < 0) {
    // Nothing passes even at the lowest price searched: report what never passes
    const lowResult = evaluate(stepSize);
    return {
      maxPrice: 0,
      meetsAllCriteria: false,
      unbounded: false,
      checks: lowResult.checks,
      limitingCriteria: lowResult.checks.filter((c) => !c.passes),
    };
  }

  // Bisect between the passing and failing grid points to within $500
  let failing = passing + stepSize;
  while (failing - passing > 500) {
    const mid = (passing + failing) / 2;
    if (evaluate(mid).passes) {
      passing = mid;
    } else {
      failing = mid;
    }
  }

  const maxPrice = Math.floor(passing / 100) * 100;
  const atMax = evaluate(maxPrice);
  const aboveMax = evaluate(failing);
  return {
    maxPrice,
    meetsAllCriteria: atMax.passes,
    unbounded: false,
    checks: atMax.checks,
    limitingCriteria: aboveMax.checks.filter((c) => !c.passes),
  };
}

export function solveMaxOffer(inputs: PropertyInputs, scenario: SolverScenario): OfferSolverResult {
  const solved = solveMaxPrice(
    (price) => analyzeOfferAtPrice(inputs, price, scenario),
    Math.max(inputs.askingPrice, calculateFairMarketValue(inputs))
  );
  const offer = calculateOfferAtPrice(inputs, solved.maxPrice, scenario);
  return {
    maxOfferPrice: solved.maxPrice,
    meetsAllCriteria: solved.meetsAllCriteria,
    limitingCriteria: solved.limitingCriteria,
    checks: solved.checks,
    unbounded: solved.unbounded,
    totalCapitalRequired: offer.totalCapitalRequired,
    annualCashFlow: offer.cashFlow,
  };
}

export function solveMaxDSCROffer(inputs: PropertyInputs): OfferSolverResult {
  return solveMaxOffer(inputs, 'dscr');
}

export function solveMaxSellerFinanceOffer(inputs: PropertyInputs): OfferSolverResult {
  return solveMaxOffer(inputs, 'seller');
}

// Scenario-specific deal readiness at the scenario's offer price
export function getScenarioReadiness(
  inputs: PropertyInputs,
  offer: OfferResult,
  offerPrice: number,
  scenario: SolverScenario
): DealReadinessMetric[] {
  const { dscr } = offer;
  const { rate, amortization } = scenarioTerms(inputs, scenario);
  const exit = calculateOfferExitData(offer, inputs, rate, amortization);
  const { avgCashOnCash, memberCashFlowYear1, memberCOCYear1, aar, totalROI, irr } = exit;

  // Calculate GRM - Gross Rent Multiplier
  const grossAnnualRent = inputs.grossMonthlyRents * 12;
  const grm = grossAnnualRent > 0 ? offerPrice / grossAnnualRent : 0;

  // Expenses as % of EGI
  const egi = calculateEffectiveGrossIncome(inputs);
  const operatingExpenses = calculateOperatingExpenses(inputs);
  const expensePercent = egi > 0 ? (operatingExpenses / egi) * 100 : 0;

  const cashFlowPerDoor = inputs.units > 0 ? offer.cashFlow / inputs.units / 12 : 0;
  const capitalReturned = exit.pctInvestmentReturnedAtRefi;

  const { minDSCR, minCashOnCash, minIRR, minAAR, minCapitalReturned, minCashFlowPerDoor, minExpenseRatio, maxGRM } = inputs;

  return [
    {
      name: 'AVG COC',
      value: avgCashOnCash,
      threshold: minCashOnCash,
      passes: avgCashOnCash >= minCashOnCash,
      comment: avgCashOnCash >= minCashOnCash
        ? 'Strong average returns over hold period'
        : `${formatPercent(avgCashOnCash)} is below ${minCashOnCash}% target`,
      unit: '%',
      whyItMatters: 'Average Cash-on-Cash return measures your average annual cash return on equity invested across the entire hold period, accounting for capital returned at refinance.',
      lookForInOM: [
        'Rent growth potential over hold period',
        'Value-add opportunities to boost NOI',
        'Lease expiration schedule for rent bumps'
      ],
      whatToAdjust: [
        'Reduce offer price to improve cash flow',
        'Negotiate better financing terms',
        'Target earlier refinance to return capital faster'
      ],
    },
    {
      name: 'DSCR',
      value: dscr,
      threshold: minDSCR,
      passes: dscr >= minDSCR,
      comment: dscr >= minDSCR
        ? 'Strong debt coverage'
        : `DSCR of ${formatNumber(dscr, 2)}x is below ${minDSCR}x lender minimum`,
      unit: 'x',
      whyItMatters: 'Debt Service Coverage Ratio measures how much cash flow covers your debt payment. Most lenders require 1.20-1.25x minimum.',
      lookForInOM: [
        'NOI growth potential to improve DSCR over time',
        'Below-market rents that can be increased',
        'Expense reduction opportunities'
      ],
      whatToAdjust: [
        'Lower your offer price to reduce debt load',
        scenario === 'seller' ? 'Negotiate longer amortization or lower rate with seller' : 'Extend amortization period to reduce monthly payment',
        'Increase down payment to reduce loan amount'
      ],
    },
    {
      name: 'Cash Flow/Door',
      value: cashFlowPerDoor,
      threshold: minCashFlowPerDoor,
      passes: cashFlowPerDoor >= minCashFlowPerDoor,
      comment: cashFlowPerDoor >= minCashFlowPerDoor
        ? 'Healthy per-door cash flow after debt service'
        : `Below $${minCashFlowPerDoor}/door/mo - thin margins`,
      unit: '$/mo',
      whyItMatters: 'Cash flow per door is your buffer against unexpected vacancies, repairs, or rate increases.',
      lookForInOM: ['Unit mix and rent comparables', 'Capital improvement history'],
      whatToAdjust: ['Lower offer price', 'Model rent increases', 'Identify expense reductions'],
    },
    {
      name: 'GRM',
      value: grm,
      threshold: maxGRM,
      passes: grm <= maxGRM,
      comment: grm <= maxGRM
        ? 'Favorable price-to-rent ratio'
        : `${formatNumber(grm, 2)}x is above ${maxGRM}x target (lower is better)`,
      unit: 'x',
      whyItMatters: 'Gross Rent Multiplier shows how many years of gross rent it takes to pay off the purchase price. Lower is better - typically 8-12x for multifamily.',
      lookForInOM: [
        'Market rent comparables',
        'Below-market units that can be brought to market',
        'Value-add potential to increase rents'
      ],
      whatToAdjust: [
        'Lower offer price',
        'Identify rent upside to reduce effective GRM',
        'Compare to market GRM for similar properties'
      ],
    },
    {
      name: 'CF to Members (Yr 1)',
      value: memberCashFlowYear1,
      threshold: 0,
      passes: memberCashFlowYear1 > 0,
      comment: memberCashFlowYear1 > 0
        ? 'Positive member distributions year one'
        : 'No cash flow to members - deal may require capital calls',
      unit: '$',
      whyItMatters: 'First-year cash flow to members is what investors actually receive. Positive distributions year one builds investor confidence.',
      lookForInOM: [
        'In-place NOI and operating history',
        'Deferred maintenance that impacts cash flow',
        'Stabilization timeline'
      ],
      whatToAdjust: [
        'Lower offer price to improve cash flow',
        'Reduce operating expenses where possible',
        'Negotiate better debt terms'
      ],
    },
    {
      name: 'Member COC (Yr 1)',
      value: memberCOCYear1,
      threshold: minCashOnCash,
      passes: memberCOCYear1 >= minCashOnCash,
      comment: memberCOCYear1 >= minCashOnCash
        ? 'Strong first-year member returns'
        : `${formatPercent(memberCOCYear1)} is below ${minCashOnCash}% target`,
      unit: '%',
      whyItMatters: 'Year 1 Member Cash-on-Cash shows the percentage return to limited partners in the first year based on their capital contribution.',
      lookForInOM: [
        'Quick-win income opportunities',
        'Expense reduction potential',
        'Occupancy improvement timeline'
      ],
      whatToAdjust: [
        'Reduce purchase price',
        'Identify immediate value-add opportunities',
        'Negotiate better financing'
      ],
    },
    {
      name: 'AAR',
      value: aar,
      threshold: minAAR,
      passes: aar >= minAAR,
      comment: aar >= minAAR
        ? 'Attractive average returns'
        : `${formatPercent(aar)} is below ${minAAR}% target`,
      unit: '%',
      whyItMatters: exit.hasRefi
        ? 'Average Annual Return equals IRR when the plan includes a refinance.'
        : 'Average Annual Return divides total member returns by years held. Easy to communicate to investors.',
      lookForInOM: [
        'Value-add improvement timeline and costs',
        'Rent increase schedule and magnitude',
        'Operating expense improvement potential'
      ],
      whatToAdjust: [
        'Extend hold period if appreciation potential is strong',
        'Focus on value-add to boost total returns',
        'Model conservative vs optimistic scenarios'
      ],
    },
    {
      name: 'Total ROI',
      value: totalROI,
      threshold: 100,
      passes: totalROI >= 100,
      comment: totalROI >= 100
        ? 'Strong total return on investment'
        : `${formatPercent(totalROI)} is below 100% target`,
      unit: '%',
      whyItMatters: 'Total Return on Investment shows your total gain as a percentage of capital invested, including cash flow and profits from refinance/sale.',
      lookForInOM: [
        'Appreciation potential in the market',
        'Value-add opportunities',
        'Cap rate compression trends'
      ],
      whatToAdjust: [
        'Lower purchase price to improve returns',
        'Extend hold period for more appreciation',
        'Focus on NOI growth'
      ],
    },
    {
      name: 'IRR',
      value: irr,
      threshold: minIRR,
      passes: irr >= minIRR,
      comment: irr >= minIRR
        ? 'Strong internal rate of return'
        : `${formatPercent(irr)} is below ${minIRR}% target`,
      unit: '%',
      whyItMatters: 'Internal Rate of Return is the time-weighted total return including cash flow, appreciation, and principal paydown.',
      lookForInOM: [
        'Recent comparable sales and cap rate trends',
        'Submarket appreciation forecasts',
        'Value-add potential for forced appreciation'
      ],
      whatToAdjust: [
        'Review exit cap rate assumptions—are they realistic?',
        'Model different hold periods',
        'Verify rent growth assumptions are achievable'
      ],
    },
    {
      name: 'Expenses %',
      value: expensePercent,
      threshold: minExpenseRatio,
      passes: expensePercent >= minExpenseRatio,
      comment: expensePercent >= minExpenseRatio
        ? 'Conservative expense assumption'
        : `${formatPercent(expensePercent)} may be understated - verify actuals`,
      unit: '%',
      whyItMatters: `Underwriting expenses below ${minExpenseRatio}% of income usually means something is missing — management, reassessed taxes, or repairs.`,
      lookForInOM: [
        'Trailing 12-month operating statements',
        'Property tax assessment timing',
        'Utility costs and metering',
        'Management fee structure'
      ],
      whatToAdjust: [
        'Verify T-12 expenses are complete',
        'Add management if the owner self-manages',
        'Use reassessed taxes at your purchase price'
      ],
    },
    {
      name: exit.hasRefi ? `Capital Ret. (Yr ${exit.refiYear})` : 'Capital Ret.',
      value: capitalReturned,
      threshold: minCapitalReturned,
      // Only applies when the plan includes a refinance
      passes: !exit.hasRefi || capitalReturned >= minCapitalReturned,
      comment: !exit.hasRefi
        ? 'No refinance planned'
        : capitalReturned >= minCapitalReturned
          ? 'Good equity return at refi'
          : `${formatPercent(capitalReturned)} is below ${minCapitalReturned}% target`,
      unit: '%',
      whyItMatters: 'Capital Returned at refinance shows how much of the initial investment comes back to investors, de-risking the deal.',
      lookForInOM: [
        'Forced appreciation opportunities through renovations',
        'Cap rate compression potential in the market',
        'NOI growth trajectory post-stabilization'
      ],
      whatToAdjust: [
        'Target higher refi LTV (if sustainable DSCR)',
        'Focus on NOI improvements before refinance year',
        'Review refinance timing—earlier may return less capital'
      ],
    },
  ];
}
