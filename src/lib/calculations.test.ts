// Pinned to numbers verified three ways on 2026-11-16: the Multifamily Deal Calculator
// spreadsheet recalculated in a spreadsheet engine, a from-scratch hand rebuild, and this
// package. Where the model deliberately follows the cash instead of the spreadsheet
// (see calculateOfferExitData), the expected values come from the hand rebuild.
import { describe, expect, it } from 'vitest';
import { PropertyInputs, defaultInputs, calculateNOI, calculateOfferAtPrice, calculateMonthlyPayment, getDealInsights } from './underwriting-calculations';
import { calculateOfferExitData } from './exit-calculations';
import { analyzeOfferAtPrice, solveMaxOffer } from './scenario-analysis';
import { calculateStackDeal, getStackReadiness } from './stack-calculations';

// 24 units, $1.7M, $288,000 rent, 8% vacancy + 2% concessions, $12,000 other income,
// $135,600 expenses, 25% down at 6.5% over 25 years, $120,000 repairs, $48,000 reserves.
const PRICE = 1_700_000;
const deal = (over: Partial<PropertyInputs> = {}): PropertyInputs => ({
  ...defaultInputs,
  askingPrice: 1_850_000,
  units: 24,
  grossMonthlyRents: 24_000,
  otherIncome: 12_000,
  vacancyRate: 8,
  concessionsRate: 2,
  expenseMode: 'dollar',
  expenseAmount: 135_600,
  marketCapRate: 7,
  exitCapRate: 7,
  ltv: 75,
  interestRate: 6.5,
  amortizationYears: 25,
  interestOnlyMonths: 0,
  repairs: 120_000,
  operatingReserves: 48_000,
  closingCostsPercent: (59_307 / PRICE) * 100,
  acquisitionFeePercent: 2,
  annualRentGrowth: 3,
  annualExpenseGrowth: 2,
  sellingCostsPercent: 3,
  refinanceAtYear: 0,
  saleAtYear: 5,
  refiLTV: 75,
  refiInterestRate: 6.5,
  refiAmortization: 25,
  refiCostsPercent: 2,
  prepaymentPenaltyPercent: 0,
  reservesReturnedPercent: 50,
  capitalTransactionFeePercent: 1,
  memberProfitSharePercent: 70,
  assetManagementFeePercent: 1.5,
  exitCapRateIncreasePerYear: 0.1,
  ...over,
});
const run = (inputs: PropertyInputs, price = PRICE) => {
  const offer = calculateOfferAtPrice(inputs, price, 'dscr');
  return { offer, exit: calculateOfferExitData(offer, inputs, inputs.interestRate, inputs.amortizationYears) };
};
// Every dollar back minus every dollar in, straight from the yearly cash and the two capital events
const cashIdentity = (x: ReturnType<typeof run>) =>
  x.exit.memberCashFlows.reduce((a, b) => a + b, 0) + x.exit.totalCashPaidToMembers - x.offer.totalCapitalRequired;

describe('basics', () => {
  it('loan payment matches the standard formula', () => {
    expect(calculateMonthlyPayment(1_275_000, 6.5, 25)).toBeCloseTo(8608.89, 2);
    expect(calculateMonthlyPayment(720_000, 7, 25)).toBeCloseTo(5088.81, 2);
  });
  it('NOI and capital at closing', () => {
    const { offer } = run(deal());
    expect(calculateNOI(deal())).toBeCloseTo(135_600, 2);
    expect(offer.totalCapitalRequired).toBeCloseTo(686_307, 2);
    expect(offer.annualDebtService).toBeCloseTo(103_306.7, 1);
    expect(offer.dscr).toBeCloseTo(1.3126, 3);
  });
});

describe('a plain five-year sale matches the spreadsheet to the cent', () => {
  const { exit } = run(deal());
  it('yearly cash to members', () => {
    [19_757.71, 23_469.09, 27_310.78, 31_287.09, 35_402.45].forEach((v, i) => expect(exit.memberCashFlows[i]).toBeCloseTo(v, 2));
  });
  it('sale', () => {
    expect(exit.salePrice).toBeCloseTo(2_112_802.51, 2);
    expect(exit.outstandingBalanceAtSale).toBeCloseTo(1_154_667.58, 2);
    expect(exit.totalEquity).toBeCloseTo(918_750.85, 2);
    expect(exit.returnOfCapitalAtSale).toBeCloseTo(686_307, 2);
    expect(exit.capitalTransactionFeeSale).toBeCloseTo(21_128.03, 2);
    expect(exit.memberProfitSale).toBeCloseTo(147_921.08, 2);
  });
  it('returns', () => {
    expect(exit.irr).toBeCloseTo(7.712, 2);
    expect(exit.aar).toBeCloseTo(8.31, 2);
    expect(exit.totalROI).toBeCloseTo(41.548, 2);
    expect(exit.avgCashOnCash).toBeCloseTo(3.999, 2);
    expect(exit.memberCOCYear1).toBeCloseTo(2.879, 2);
    expect(exit.memberCapitalAdded).toBe(0);
    expect(exit.reservesUsed).toBe(0);
  });
});

describe('longer holds and refinances', () => {
  it('a ten-year hold counts year 6 in the IRR (the spreadsheet skips it and shows 9.08%)', () => {
    expect(run(deal({ saleAtYear: 10 })).exit.irr).toBeCloseTo(9.527, 2);
  });
  it('refinance in year 3, sale in year 7', () => {
    const x = run(deal({ refinanceAtYear: 3, saleAtYear: 7 }));
    expect(x.exit.refiAppraisedValue).toBeCloseTo(2_008_737.53, 2);
    expect(x.exit.returnOfCapitalAtRefi).toBeCloseTo(258_856.94, 2);
    expect(x.exit.capitalAccountAfterRefi).toBeCloseTo(427_450.06, 2);
    expect(x.exit.memberProfitSale).toBeCloseTo(233_366.61, 2);
    expect(x.exit.irr).toBeCloseTo(8.933, 2);
    expect(x.exit.totalROI).toBeCloseTo(58.544, 2);
    // AAR is profit per year held, not the IRR
    expect(x.exit.aar).toBeCloseTo(58.544 / 7, 2);
    expect(x.exit.totalCashToMembers).toBeCloseTo(cashIdentity(x), 6);
  });
  it('average cash-on-cash is measured on the capital put in, so a refinance cannot inflate it', () => {
    // The spreadsheet shows 7.2% here and calls it good; no single year before the refinance pays more than 5.2%
    const x = run(deal({ refinanceAtYear: 5, saleAtYear: 10 }));
    const expected = x.exit.memberCashFlows.reduce((a, cf) => a + cf / 686_307, 0) / 10 * 100;
    expect(x.exit.avgCashOnCash).toBeCloseTo(expected, 6);
    expect(x.exit.avgCashOnCash).toBeCloseTo(4.275, 2);
  });
  it('a refinance set in the sale year is just the sale', () => {
    const sameYear = run(deal({ refinanceAtYear: 5, saleAtYear: 5 })).exit;
    const saleOnly = run(deal()).exit;
    expect(sameYear.hasRefi).toBe(false);
    expect(sameYear.irr).toBeCloseTo(saleOnly.irr, 6);
    expect(sameYear.totalROI).toBeCloseTo(saleOnly.totalROI, 6);
  });
});

describe('when the deal comes up short, the members pay', () => {
  const losing = deal({ expenseAmount: 0.7 * 271_200, refinanceAtYear: 3, saleAtYear: 7 });
  const x = run(losing, 2_400_000);
  it('losing years draw down the reserves first, then the members', () => {
    // NOI 81,360 against 145,844.75 of debt service: 64,484.75 short in year one
    expect(x.offer.cashFlow).toBeCloseTo(-64_484.75, 2);
    expect(x.exit.reservesUsed).toBeCloseTo(48_000, 2);
    expect(x.exit.memberCashFlows[0]).toBeCloseTo(-(64_484.75 - 48_000), 2);
    expect(x.exit.memberCashFlows[1]).toBeLessThan(0);
    expect(x.exit.reservesReturned).toBe(0);
  });
  it('a short refinance is money in (the spreadsheet agrees: 802,670.73)', () => {
    expect(x.exit.grossRefiProceeds).toBeCloseTo(-802_670.73, 2);
    expect(x.exit.capitalAddedAtRefi).toBeCloseTo(802_670.73, 2);
    expect(x.exit.returnOfCapitalAtRefi).toBe(0);
    expect(x.exit.pctInvestmentReturnedAtRefi).toBe(0);
  });
  it('profit is cash back minus cash in, and the returns are negative', () => {
    expect(x.exit.totalCashToMembers).toBeCloseTo(cashIdentity(x), 6);
    expect(x.exit.totalCashToMembers).toBeLessThan(0);
    expect(x.exit.irr).toBeLessThan(-18);
    expect(x.exit.aar).toBeLessThan(0);
    expect(x.exit.avgCashOnCash).toBeLessThan(1);
  });
  it('a sale that does not clear the loan is money in', () => {
    const u = run(deal({ exitCapRate: 11 }), 2_400_000);
    expect(u.exit.totalEquity).toBeLessThan(0);
    expect(u.exit.capitalAddedAtSale).toBeCloseTo(-u.exit.totalEquity, 6);
    expect(u.exit.totalCashToMembersAtSale).toBeCloseTo(u.exit.totalEquity, 6);
    expect(u.exit.totalCashToMembers).toBeCloseTo(cashIdentity(u), 6);
    expect(u.exit.totalROI).toBeLessThan(-100 * 0.9);
  });
  it('never reports a gain on a deal that only loses', () => {
    const y = run(deal({ expenseAmount: 0.7 * 271_200 }), 2_400_000);
    expect(y.exit.totalCashToMembers).toBeLessThan(0);
    expect(y.exit.irr).toBeLessThan(0);
  });
});

describe('max offer', () => {
  it('passes every limit at the price it returns and is checked on the honest average', () => {
    const inputs = { ...defaultInputs, askingPrice: 900_000 };
    const solved = solveMaxOffer(inputs, 'dscr');
    const at = analyzeOfferAtPrice(inputs, solved.maxOfferPrice, 'dscr');
    expect(solved.meetsAllCriteria).toBe(true);
    expect(at.passes).toBe(true);
    const coc = at.checks.find((c) => c.key === 'coc')!;
    expect(coc.value).toBeGreaterThanOrEqual(inputs.minCashOnCash);
    // No year's cash-on-cash can sit far below an average that passes because of one inflated year
    expect(coc.value).toBeLessThan(15);
  });
});

describe('deal tips', () => {
  it('suggested DSCR price lands on the limit, interest-only months included', () => {
    const inputs = { ...defaultInputs, askingPrice: 1_100_000, interestOnlyMonths: 24 };
    const tip = getDealInsights(inputs).find((i) => i.id === 'low-dscr')!;
    const price = Number(tip.targetValue!.replace(/[$,]/g, ''));
    expect(calculateOfferAtPrice(inputs, price, 'dscr').dscr).toBeCloseTo(inputs.minDSCR, 2);
  });
  it('gives a real number at a 0% rate', () => {
    const tip = getDealInsights({ ...defaultInputs, askingPrice: 3_000_000, interestRate: 0 }).find((i) => i.id === 'low-dscr');
    expect(tip?.targetValue).toMatch(/^\$[\d,]+$/);
  });
  it('uses the limits from settings', () => {
    const strict = getDealInsights({ ...defaultInputs, askingPrice: 700_000, minDSCR: 2 }).find((i) => i.id === 'low-dscr');
    expect(strict?.summary).toContain('2.00');
  });
});

describe('stack', () => {
  const stack = { ...defaultInputs, stackPurchasePrice: 900_000, stackUnits: 10, stackAvgRentPerUnit: 1200 };
  it('default structure closes with no cash from the buyer', () => {
    const calc = calculateStackDeal(stack, 900_000);
    expect(calc.buyerWalkAwayCash).toBeCloseTo(104_373, 0);
    expect(calc.buyerCashNeeded).toBe(0);
  });
  it('too little seller carry is cash the buyer brings, and fails a check', () => {
    const inputs = { ...stack, stackSellerFinancePct: 30 };
    const calc = calculateStackDeal(inputs, 900_000);
    expect(calc.buyerCashNeeded).toBeCloseTo(75_627, 0);
    expect(getStackReadiness(inputs, calc).find((m) => m.check.key === 'cashToClose')!.pass).toBe(false);
  });
  it('a refi year at or after the sale year means no refinance', () => {
    const calc = calculateStackDeal({ ...stack, stackRefiYear: 8, stackSaleYear: 7 }, 900_000);
    expect(calc.hasRefi).toBe(false);
    expect(calc.netRefiProceeds).toBe(0);
    expect(calc.refiLoanBalanceAtSale).toBeLessThan(calc.firstLienAmt + calc.secondLienAmt);
    expect(calc.totalReturn).toBeCloseTo(calc.totalCashFromOps + calc.netSaleProceeds, 6);
  });
});
