// All calculation functions for the underwriting tool

export interface PropertyInputs {
  propertyName: string;
  propertyAddress: string;
  askingPrice: number;
  purchasePrice: number;
  units: number;
  grossMonthlyRents: number;
  otherIncome: number;
  vacancyRate: number;
  expenseRate: number;
  expenseAmount: number; // Fixed dollar amount for expenses
  expenseMode: 'percent' | 'dollar'; // Toggle between % and $
  marketCapRate: number;
  concessionsRate: number;
  downPaymentPercent: number;
  interestRate: number;
  amortizationYears: number;
  interestOnlyMonths: number;
  ltv: number;
  repairs: number;
  operatingReserves: number;
  closingCostsPercent: number;
  // Exit assumptions
  annualRentGrowth: number;
  annualExpenseGrowth: number;
  exitCapRate: number;
  sellingCostsPercent: number;
  refinanceAtYear: number;
  saleAtYear: number;
  // Seller financing
  sellerFinanceDownPaymentPercent: number;
  sellerFinanceRate: number;
  sellerFinanceAmortization: number;
  sellerFinanceBalloonYears: number;
  sellerFinanceAmount: number;
  // Subject-to
  existingDebtBalance: number;
  existingDebtRate: number;
  existingDebtPayment: number;
  // Hybrid
  dscrLoanPercent: number;
  // Investment criteria thresholds
  minDSCR: number;
  minCashOnCash: number;
  minIRR: number;
  minAAR: number;
  minCapitalReturned: number;
  minCashFlowPerDoor: number;
  minExpenseRatio: number; // Lowest expense assumption (% of EGI) that counts as conservative
  maxGRM: number;
  // Syndication / Exit settings
  acquisitionFeePercent: number; // % of purchase price paid to the manager at close, funded by members
  refiLTV: number;
  refiInterestRate: number;
  refiAmortization: number;
  refiCostsPercent: number;
  prepaymentPenaltyPercent: number;
  reservesReturnedPercent: number;
  capitalTransactionFeePercent: number;
  memberProfitSharePercent: number;
  assetManagementFeePercent: number; // % of EGI deducted before profit split
  exitCapRateIncreasePerYear: number; // Annual cap rate increase for sale projections
  // Scenario-specific offer prices (0 = use askingPrice)
  dscrOfferPrice: number;
  sellerOfferPrice: number;
  subtoOfferPrice: number;
  hybridOfferPrice: number;
  // Stack Method inputs
  stackPurchasePrice: number;
  stackSellerFinancePct: number;
  stackSellerClosingCostsPct: number;
  stackReCommissionPct: number;
  stackOutstandingLoan: number;
  stackLoanLtvPct: number;
  stackBuyerClosingCostsPct: number;
  stackOriginationFeePct: number;
  stackTfFeePct: number;
  stackFirstLienRate: number;
  stackFirstLienAmort: number;
  stackSecondLienRate: number;
  stackSecondLienAmort: number;
  stackUnits: number;
  stackAvgRentPerUnit: number;
  stackOccupancyPct: number;
  stackPropMgmtPct: number;
  stackMaintenanceReservePct: number;
  stackInsuranceMo: number;
  stackTaxesMo: number;
  stackUtilitiesMo: number;
  stackRefiYear: number;
  stackSaleYear: number;
  stackExitCapRate: number;
  stackCapRateIncreasePerYear: number;
  stackRefiLTV: number;
  stackRefiRate: number;
  stackRefiAmort: number;
  stackRefiCostsPct: number;
  stackSellingCostsPct: number;
  stackPrepayPenaltyPct: number;
  stackRentGrowthPct: number;
  // Stack Method criteria
  stackMaxCombinedLTV: number;
  stackMaxExpenseRatio: number;
}

export const defaultInputs: PropertyInputs = {
  propertyName: '',
  propertyAddress: '',
  askingPrice: 0,
  purchasePrice: 0, // Now derived per-offer from solver, not set manually
  units: 10,
  grossMonthlyRents: 12000,
  otherIncome: 0,
  vacancyRate: 10,
  expenseRate: 50,
  expenseAmount: 0,
  expenseMode: 'percent',
  marketCapRate: 7,
  concessionsRate: 2,
  downPaymentPercent: 25,
  interestRate: 7,
  amortizationYears: 25,
  interestOnlyMonths: 0,
  ltv: 80,
  repairs: 50000,
  operatingReserves: 25000,
  closingCostsPercent: 2.5,
  annualRentGrowth: 3,
  annualExpenseGrowth: 2,
  exitCapRate: 7,
  sellingCostsPercent: 6,
  refinanceAtYear: 5,
  saleAtYear: 10,
  sellerFinanceDownPaymentPercent: 20,
  sellerFinanceRate: 6,
  sellerFinanceAmortization: 30,
  sellerFinanceBalloonYears: 5,
  sellerFinanceAmount: 0,
  existingDebtBalance: 0,
  existingDebtRate: 5,
  existingDebtPayment: 0,
  dscrLoanPercent: 60,
  // Investment criteria defaults
  minDSCR: 1.25,
  minCashOnCash: 7,
  minIRR: 12,
  minAAR: 13,
  minCapitalReturned: 60,
  minCashFlowPerDoor: 100,
  minExpenseRatio: 50,
  maxGRM: 10,
  // Syndication / Exit defaults
  acquisitionFeePercent: 5,
  refiLTV: 75,
  refiInterestRate: 6.5,
  refiAmortization: 25,
  refiCostsPercent: 2,
  prepaymentPenaltyPercent: 0,
  reservesReturnedPercent: 50,
  capitalTransactionFeePercent: 1,
  memberProfitSharePercent: 70,
  assetManagementFeePercent: 1.5, // Default 1.5% of EGI
  exitCapRateIncreasePerYear: 0.1, // Default 0.10% cap rate increase per year
  // Scenario-specific offer prices (0 = use askingPrice)
  dscrOfferPrice: 0,
  sellerOfferPrice: 0,
  subtoOfferPrice: 0,
  hybridOfferPrice: 0,
  // Stack Method defaults
  stackPurchasePrice: 0,
  stackSellerFinancePct: 50,
  stackSellerClosingCostsPct: 3,
  stackReCommissionPct: 5,
  stackOutstandingLoan: 0,
  stackLoanLtvPct: 65,
  stackBuyerClosingCostsPct: 2,
  stackOriginationFeePct: 1,
  stackTfFeePct: 2,
  stackFirstLienRate: 7.5,
  stackFirstLienAmort: 30,
  stackSecondLienRate: 5,
  stackSecondLienAmort: 25,
  stackUnits: 10,
  stackAvgRentPerUnit: 1000,
  stackOccupancyPct: 95,
  stackPropMgmtPct: 8,
  stackMaintenanceReservePct: 5,
  stackInsuranceMo: 500,
  stackTaxesMo: 800,
  stackUtilitiesMo: 300,
  stackRefiYear: 3,
  stackSaleYear: 7,
  stackExitCapRate: 6,
  stackCapRateIncreasePerYear: 0.1,
  stackRefiLTV: 75,
  stackRefiRate: 6.5,
  stackRefiAmort: 30,
  stackRefiCostsPct: 1,
  stackSellingCostsPct: 3,
  stackPrepayPenaltyPct: 1,
  stackRentGrowthPct: 3,
  stackMaxCombinedLTV: 115,
  stackMaxExpenseRatio: 50,
};

// Core calculations
export function calculateGrossAnnualIncome(inputs: PropertyInputs): number {
  return inputs.grossMonthlyRents * 12;
}

export function calculateEffectiveGrossIncome(inputs: PropertyInputs): number {
  const gross = calculateGrossAnnualIncome(inputs);
  const vacancyLoss = gross * (inputs.vacancyRate / 100);
  const concessions = gross * (inputs.concessionsRate / 100);
  return gross - vacancyLoss - concessions + (inputs.otherIncome || 0);
}

// Helper functions for display purposes
export function calculateGrossPotentialRent(inputs: PropertyInputs): number {
  return inputs.grossMonthlyRents * 12;
}

export function calculateVacancyLoss(inputs: PropertyInputs): number {
  return calculateGrossPotentialRent(inputs) * (inputs.vacancyRate / 100);
}

export function calculateConcessionsLoss(inputs: PropertyInputs): number {
  return calculateGrossPotentialRent(inputs) * (inputs.concessionsRate / 100);
}

export function calculateClosingCostsAmount(inputs: PropertyInputs): number {
  return inputs.purchasePrice * (inputs.closingCostsPercent / 100);
}

export function calculateOperatingExpenses(inputs: PropertyInputs): number {
  if (inputs.expenseMode === 'dollar' && inputs.expenseAmount > 0) {
    return inputs.expenseAmount;
  }
  const egi = calculateEffectiveGrossIncome(inputs);
  return egi * (inputs.expenseRate / 100);
}

export function calculateNOI(inputs: PropertyInputs): number {
  return calculateEffectiveGrossIncome(inputs) - calculateOperatingExpenses(inputs);
}

export function calculateFairMarketValue(inputs: PropertyInputs): number {
  const noi = calculateNOI(inputs);
  return noi / (inputs.marketCapRate / 100);
}

export function calculateCapRate(inputs: PropertyInputs): number {
  const noi = calculateNOI(inputs);
  return (noi / inputs.purchasePrice) * 100;
}

export function calculateGRM(inputs: PropertyInputs): number {
  const grossAnnual = calculateGrossAnnualIncome(inputs);
  return inputs.purchasePrice / grossAnnual;
}

export function check1PercentRule(inputs: PropertyInputs): boolean {
  const monthlyRentRatio = inputs.grossMonthlyRents / inputs.purchasePrice;
  return monthlyRentRatio >= 0.01;
}

// Financing calculations
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  amortizationYears: number
): number {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = amortizationYears * 12;
  
  if (monthlyRate === 0) return principal / numPayments;
  
  return (
    principal *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

export function calculateLoanAmount(inputs: PropertyInputs): number {
  return inputs.purchasePrice * (inputs.ltv / 100);
}

export function calculateDownPayment(inputs: PropertyInputs): number {
  return inputs.purchasePrice * (inputs.downPaymentPercent / 100);
}

export function calculateAnnualDebtService(inputs: PropertyInputs): number {
  const loanAmount = calculateLoanAmount(inputs);
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    inputs.interestRate,
    inputs.amortizationYears
  );
  return monthlyPayment * 12;
}

export function calculateDSCR(inputs: PropertyInputs): number {
  const noi = calculateNOI(inputs);
  const debtService = calculateAnnualDebtService(inputs);
  if (debtService === 0) return 0;
  return noi / debtService;
}

export function calculateCashFlow(inputs: PropertyInputs): number {
  return calculateNOI(inputs) - calculateAnnualDebtService(inputs);
}

// Manager's acquisition fee, raised from members at close like closing costs
export function calculateAcquisitionFee(inputs: PropertyInputs, purchasePrice: number): number {
  return purchasePrice * ((inputs.acquisitionFeePercent ?? 0) / 100);
}

export function calculateTotalCapitalRequired(inputs: PropertyInputs): number {
  const downPayment = calculateDownPayment(inputs);
  const closingCosts = inputs.purchasePrice * (inputs.closingCostsPercent / 100);
  return downPayment + inputs.repairs + inputs.operatingReserves + closingCosts + calculateAcquisitionFee(inputs, inputs.purchasePrice);
}

export function calculateCashOnCash(inputs: PropertyInputs): number {
  const cashFlow = calculateCashFlow(inputs);
  const totalCapital = calculateTotalCapitalRequired(inputs);
  if (totalCapital === 0) return 0;
  return (cashFlow / totalCapital) * 100;
}

// Per unit metrics
export function calculatePricePerUnit(inputs: PropertyInputs): number {
  return inputs.purchasePrice / inputs.units;
}

export function calculateRentPerUnit(inputs: PropertyInputs): number {
  return inputs.grossMonthlyRents / inputs.units;
}

export function calculateNOIPerUnit(inputs: PropertyInputs): number {
  return calculateNOI(inputs) / inputs.units;
}

export function calculateDebtServicePerUnit(inputs: PropertyInputs): number {
  return calculateAnnualDebtService(inputs) / inputs.units;
}

export function calculateCashFlowPerUnit(inputs: PropertyInputs): number {
  return calculateCashFlow(inputs) / inputs.units;
}

// Exit strategy calculations - now use configurable years
export function calculateProjectedNOI(inputs: PropertyInputs, years: number): number {
  const rentGrowthFactor = Math.pow(1 + inputs.annualRentGrowth / 100, years);
  const expenseGrowthFactor = Math.pow(1 + inputs.annualExpenseGrowth / 100, years);
  
  // Apply growth to Gross Potential Rent (not EGI)
  const currentGPR = calculateGrossPotentialRent(inputs);
  const projectedGPR = currentGPR * rentGrowthFactor;
  
  // Apply growth to other income as well
  const projectedOtherIncome = (inputs.otherIncome || 0) * rentGrowthFactor;
  
  // Recalculate vacancy and concessions from projected GPR
  const projectedVacancy = projectedGPR * (inputs.vacancyRate / 100);
  const projectedConcessions = projectedGPR * (inputs.concessionsRate / 100);
  
  // Projected EGI = GPR + Other Income - Vacancy - Concessions
  const projectedEGI = projectedGPR + projectedOtherIncome - projectedVacancy - projectedConcessions;
  
  // Project operating expenses
  const currentExpenses = calculateOperatingExpenses(inputs);
  const projectedExpenses = currentExpenses * expenseGrowthFactor;
  
  // NOI = EGI - Operating Expenses
  return projectedEGI - projectedExpenses;
}

// Helper to calculate projected EGI at a given year
export function calculateProjectedEGI(inputs: PropertyInputs, years: number): number {
  const rentGrowthFactor = Math.pow(1 + inputs.annualRentGrowth / 100, years);
  
  const currentGPR = calculateGrossPotentialRent(inputs);
  const projectedGPR = currentGPR * rentGrowthFactor;
  
  const projectedOtherIncome = (inputs.otherIncome || 0) * rentGrowthFactor;
  
  const projectedVacancy = projectedGPR * (inputs.vacancyRate / 100);
  const projectedConcessions = projectedGPR * (inputs.concessionsRate / 100);
  
  return projectedGPR + projectedOtherIncome - projectedVacancy - projectedConcessions;
}

// Helper to calculate member cash flow after asset management fee
export function calculateMemberDistribution(
  totalCashFlow: number,
  egi: number,
  assetMgmtFeePercent: number | undefined,
  memberProfitSharePercent: number | undefined
): { memberCashFlow: number; managerCashFlow: number; assetMgmtFee: number } {
  // Default to 1.5% asset mgmt fee and 70% member profit if undefined (for legacy deals)
  const safeFeePercent = assetMgmtFeePercent ?? 1.5;
  const safeMemberPercent = memberProfitSharePercent ?? 70;
  
  // The fee is only taken when cash flow covers it, and neither side receives a negative distribution
  const fullFee = egi * (safeFeePercent / 100);
  const assetMgmtFee = fullFee < totalCashFlow ? fullFee : 0;
  const distributableCashFlow = totalCashFlow - assetMgmtFee;
  const memberCashFlow = Math.max(0, distributableCashFlow * (safeMemberPercent / 100));
  const managerCashFlow = Math.max(0, distributableCashFlow * (1 - safeMemberPercent / 100));
  return { memberCashFlow, managerCashFlow, assetMgmtFee };
}

export function calculateYear5NOI(inputs: PropertyInputs): number {
  return calculateProjectedNOI(inputs, inputs.refinanceAtYear);
}

export function calculateProjectedValue(inputs: PropertyInputs, years: number): number {
  const projectedNOI = calculateProjectedNOI(inputs, years);
  return projectedNOI / (inputs.exitCapRate / 100);
}

export function calculateYear5Value(inputs: PropertyInputs): number {
  return calculateProjectedValue(inputs, inputs.refinanceAtYear);
}

export function calculateLoanBalanceAtYear(inputs: PropertyInputs, years: number): number {
  const loanAmount = calculateLoanAmount(inputs);
  const monthlyRate = inputs.interestRate / 100 / 12;
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    inputs.interestRate,
    inputs.amortizationYears
  );
  
  // Calculate remaining balance after payments
  const numPayments = years * 12;
  let balance = loanAmount;
  
  for (let i = 0; i < numPayments; i++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    balance -= principalPayment;
  }
  
  return Math.max(0, balance);
}

export function calculateLoanBalanceAtYear5(inputs: PropertyInputs): number {
  return calculateLoanBalanceAtYear(inputs, inputs.refinanceAtYear);
}

export function calculateRefinanceProceeds(inputs: PropertyInputs): number {
  const projectedValue = calculateProjectedValue(inputs, inputs.refinanceAtYear);
  const newLoanAmount = projectedValue * 0.75; // 75% LTV refinance
  const currentBalance = calculateLoanBalanceAtYear(inputs, inputs.refinanceAtYear);
  return newLoanAmount - currentBalance;
}

export function calculateCapitalReturnedPercent(inputs: PropertyInputs): number {
  const refinanceProceeds = calculateRefinanceProceeds(inputs);
  const totalCapital = calculateTotalCapitalRequired(inputs);
  if (totalCapital === 0) return 0;
  return (refinanceProceeds / totalCapital) * 100;
}

export function calculateSaleProceeds(inputs: PropertyInputs): number {
  const saleValue = calculateProjectedValue(inputs, inputs.saleAtYear);
  const sellingCosts = saleValue * (inputs.sellingCostsPercent / 100);
  const loanBalance = calculateLoanBalanceAtYear(inputs, inputs.saleAtYear);
  return saleValue - sellingCosts - loanBalance;
}

// Dynamic cash flows based on sale year
export function calculateTotalCashFlows(inputs: PropertyInputs): number[] {
  const totalCapital = calculateTotalCapitalRequired(inputs);
  const annualCashFlow = calculateCashFlow(inputs);
  const saleProceeds = calculateSaleProceeds(inputs);
  const saleYear = inputs.saleAtYear;
  
  // Year 0 is negative (investment), years 1 to saleYear-1 are cash flow, saleYear is cash flow + sale
  const cashFlows: number[] = [-totalCapital];
  
  for (let year = 1; year <= saleYear; year++) {
    const growthFactor = Math.pow(1 + inputs.annualRentGrowth / 100, year - 1);
    const yearCashFlow = annualCashFlow * growthFactor;
    
    if (year === saleYear) {
      cashFlows.push(yearCashFlow + saleProceeds);
    } else {
      cashFlows.push(yearCashFlow);
    }
  }
  
  return cashFlows;
}

export function calculateIRR(cashFlows: number[]): number {
  // Newton-Raphson method for IRR
  let rate = 0.1; // Start with 10%
  const maxIterations = 100;
  const tolerance = 0.00001; // Tighter tolerance for better precision
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + rate, t);
      derivative -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
    }
    
    const newRate = rate - npv / derivative;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate * 100;
    }
    
    rate = newRate;
  }
  
  return rate * 100;
}

export function calculateAAR(inputs: PropertyInputs): number {
  const cashFlows = calculateTotalCashFlows(inputs);
  const totalReturn = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
  const totalCapital = calculateTotalCapitalRequired(inputs);
  if (totalCapital === 0) return 0;
  return ((totalReturn / totalCapital) / 5) * 100;
}

// Offer calculations
export interface OfferResult {
  loanAmount: number;
  downPayment: number;
  monthlyPayment: number;
  annualDebtService: number;
  totalCapitalRequired: number;
  dscr: number;
  cashFlow: number;
  cashOnCash: number;
}

export function calculateDSCRLoanOffer(inputs: PropertyInputs): OfferResult {
  const loanAmount = calculateLoanAmount(inputs);
  const downPayment = inputs.purchasePrice - loanAmount;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, inputs.interestRate, inputs.amortizationYears);
  const annualDebtService = monthlyPayment * 12;
  const closingCosts = inputs.purchasePrice * (inputs.closingCostsPercent / 100);
  const totalCapitalRequired = downPayment + inputs.repairs + inputs.operatingReserves + closingCosts + calculateAcquisitionFee(inputs, inputs.purchasePrice);
  const noi = calculateNOI(inputs);
  const dscr = noi / annualDebtService;
  const cashFlow = noi - annualDebtService;
  const cashOnCash = (cashFlow / totalCapitalRequired) * 100;
  
  return {
    loanAmount,
    downPayment,
    monthlyPayment,
    annualDebtService,
    totalCapitalRequired,
    dscr,
    cashFlow,
    cashOnCash,
  };
}

export function calculateSellerFinanceOffer(inputs: PropertyInputs): OfferResult {
  // Calculate loan amount from down payment percentage
  const downPayment = inputs.purchasePrice * (inputs.sellerFinanceDownPaymentPercent / 100);
  const loanAmount = inputs.purchasePrice - downPayment;
  const monthlyPayment = calculateMonthlyPayment(
    loanAmount,
    inputs.sellerFinanceRate,
    inputs.sellerFinanceAmortization
  );
  const annualDebtService = monthlyPayment * 12;
  const closingCosts = inputs.purchasePrice * (inputs.closingCostsPercent / 100);
  const totalCapitalRequired = downPayment + inputs.repairs + inputs.operatingReserves + closingCosts + calculateAcquisitionFee(inputs, inputs.purchasePrice);
  const noi = calculateNOI(inputs);
  const dscr = noi / annualDebtService;
  const cashFlow = noi - annualDebtService;
  const cashOnCash = (cashFlow / totalCapitalRequired) * 100;
  
  return {
    loanAmount,
    downPayment,
    monthlyPayment,
    annualDebtService,
    totalCapitalRequired,
    dscr,
    cashFlow,
    cashOnCash,
  };
}

export function calculateSubjectToOffer(inputs: PropertyInputs): OfferResult {
  const loanAmount = inputs.existingDebtBalance;
  const downPayment = inputs.purchasePrice - loanAmount;
  const monthlyPayment = inputs.existingDebtPayment || 
    calculateMonthlyPayment(loanAmount, inputs.existingDebtRate, 25);
  const annualDebtService = monthlyPayment * 12;
  const closingCosts = inputs.purchasePrice * (inputs.closingCostsPercent / 100);
  const totalCapitalRequired = downPayment + inputs.repairs + inputs.operatingReserves + closingCosts + calculateAcquisitionFee(inputs, inputs.purchasePrice);
  const noi = calculateNOI(inputs);
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const cashFlow = noi - annualDebtService;
  const cashOnCash = totalCapitalRequired > 0 ? (cashFlow / totalCapitalRequired) * 100 : 0;
  
  return {
    loanAmount,
    downPayment,
    monthlyPayment,
    annualDebtService,
    totalCapitalRequired,
    dscr,
    cashFlow,
    cashOnCash,
  };
}

export function calculateHybridOffer(inputs: PropertyInputs): OfferResult {
  const dscrLoanAmount = inputs.purchasePrice * (inputs.dscrLoanPercent / 100);
  const sellerCarryAmount = inputs.sellerFinanceAmount || 
    (inputs.purchasePrice - dscrLoanAmount) * 0.5;
  const downPayment = inputs.purchasePrice - dscrLoanAmount - sellerCarryAmount;
  
  const dscrMonthlyPayment = calculateMonthlyPayment(
    dscrLoanAmount,
    inputs.interestRate,
    inputs.amortizationYears
  );
  const sellerMonthlyPayment = calculateMonthlyPayment(
    sellerCarryAmount,
    inputs.sellerFinanceRate,
    inputs.sellerFinanceAmortization
  );
  
  const monthlyPayment = dscrMonthlyPayment + sellerMonthlyPayment;
  const annualDebtService = monthlyPayment * 12;
  const closingCosts = inputs.purchasePrice * (inputs.closingCostsPercent / 100);
  const totalCapitalRequired = downPayment + inputs.repairs + inputs.operatingReserves + closingCosts + calculateAcquisitionFee(inputs, inputs.purchasePrice);
  const noi = calculateNOI(inputs);
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const cashFlow = noi - annualDebtService;
  const cashOnCash = totalCapitalRequired > 0 ? (cashFlow / totalCapitalRequired) * 100 : 0;
  
  return {
    loanAmount: dscrLoanAmount + sellerCarryAmount,
    downPayment,
    monthlyPayment,
    annualDebtService,
    totalCapitalRequired,
    dscr,
    cashFlow,
    cashOnCash,
  };
}

// Calculate offer at a specific price (used for solver-derived prices)
export function calculateOfferAtPrice(
  inputs: PropertyInputs,
  purchasePrice: number,
  type: 'dscr' | 'seller' | 'subto' | 'hybrid'
): OfferResult {
  const noi = calculateNOI(inputs);
  
  let loanAmount: number;
  let downPayment: number;
  let monthlyPayment: number;
  let annualDebtService: number;
  
  switch (type) {
    case 'dscr': {
      loanAmount = purchasePrice * (inputs.ltv / 100);
      downPayment = purchasePrice - loanAmount;
      monthlyPayment = calculateMonthlyPayment(loanAmount, inputs.interestRate, inputs.amortizationYears);
      annualDebtService = monthlyPayment * 12;
      break;
    }
    case 'seller': {
      downPayment = purchasePrice * (inputs.sellerFinanceDownPaymentPercent / 100);
      loanAmount = purchasePrice - downPayment;
      monthlyPayment = calculateMonthlyPayment(loanAmount, inputs.sellerFinanceRate, inputs.sellerFinanceAmortization);
      annualDebtService = monthlyPayment * 12;
      break;
    }
    case 'subto': {
      loanAmount = inputs.existingDebtBalance;
      downPayment = purchasePrice - loanAmount;
      monthlyPayment = inputs.existingDebtPayment || calculateMonthlyPayment(loanAmount, inputs.existingDebtRate, 25);
      annualDebtService = monthlyPayment * 12;
      break;
    }
    case 'hybrid': {
      const dscrLoanAmount = purchasePrice * (inputs.dscrLoanPercent / 100);
      const sellerCarryAmount = inputs.sellerFinanceAmount || (purchasePrice - dscrLoanAmount) * 0.5;
      loanAmount = dscrLoanAmount + sellerCarryAmount;
      downPayment = purchasePrice - loanAmount;
      const dscrMonthlyPayment = calculateMonthlyPayment(dscrLoanAmount, inputs.interestRate, inputs.amortizationYears);
      const sellerMonthlyPayment = calculateMonthlyPayment(sellerCarryAmount, inputs.sellerFinanceRate, inputs.sellerFinanceAmortization);
      monthlyPayment = dscrMonthlyPayment + sellerMonthlyPayment;
      annualDebtService = monthlyPayment * 12;
      break;
    }
  }
  
  const closingCosts = purchasePrice * (inputs.closingCostsPercent / 100);
  const totalCapitalRequired = downPayment + inputs.repairs + inputs.operatingReserves + closingCosts + calculateAcquisitionFee(inputs, purchasePrice);
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const cashFlow = noi - annualDebtService;
  const cashOnCash = totalCapitalRequired > 0 ? (cashFlow / totalCapitalRequired) * 100 : 0;
  
  return {
    loanAmount,
    downPayment,
    monthlyPayment,
    annualDebtService,
    totalCapitalRequired,
    dscr,
    cashFlow,
    cashOnCash,
  };
}

// Deal readiness thresholds
export interface DealReadinessMetric {
  name: string;
  value: number;
  threshold: number;
  passes: boolean;
  comment: string;
  unit: string;
  // Educational content
  whyItMatters: string;
  lookForInOM: string[];
  whatToAdjust: string[];
}

export function getDealReadiness(inputs: PropertyInputs): DealReadinessMetric[] {
  const dscr = calculateDSCR(inputs);
  const coc = calculateCashOnCash(inputs);
  const aar = calculateAAR(inputs);
  const cashFlows = calculateTotalCashFlows(inputs);
  const irr = calculateIRR(cashFlows);
  const capitalReturned = calculateCapitalReturnedPercent(inputs);
  const cashFlowPerDoor = calculateCashFlowPerUnit(inputs) / 12; // Monthly
  
  const { minDSCR, minCashOnCash, minIRR, minAAR, minCapitalReturned, minCashFlowPerDoor } = inputs;
  
  return [
    {
      name: 'DSCR',
      value: dscr,
      threshold: minDSCR,
      passes: dscr >= minDSCR,
      comment: dscr >= minDSCR 
        ? 'Strong debt coverage - lenders will like this' 
        : `Below ${minDSCR}x - may have trouble qualifying for financing`,
      unit: 'x',
      whyItMatters: 'Debt Service Coverage Ratio measures how much cash flow covers your debt payment. Most lenders require 1.20-1.25x minimum.',
      lookForInOM: ['NOI growth potential', 'Below-market rents', 'Expense reduction opportunities'],
      whatToAdjust: ['Lower offer price', 'Negotiate better financing terms', 'Increase down payment'],
    },
    {
      name: 'Cash on Cash',
      value: coc,
      threshold: minCashOnCash,
      passes: coc >= minCashOnCash,
      comment: coc >= minCashOnCash 
        ? 'Solid year 1 returns for investors' 
        : `Below ${minCashOnCash}% target - may need to negotiate price or terms`,
      unit: '%',
      whyItMatters: 'Cash-on-Cash measures your first-year cash return on equity invested.',
      lookForInOM: ['In-place vs market rent comparison', 'Lease expiration schedule'],
      whatToAdjust: ['Reduce offer price', 'Negotiate better financing terms'],
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
      name: 'AAR (5yr)',
      value: aar,
      threshold: minAAR,
      passes: aar >= minAAR,
      comment: aar >= minAAR 
        ? 'Attractive average annual returns' 
        : `Below ${minAAR}% target - consider value-add opportunities`,
      unit: '%',
      whyItMatters: 'Average Annual Return is a simpler metric that divides total returns by years held.',
      lookForInOM: ['Value-add improvement timeline', 'Rent increase schedule'],
      whatToAdjust: ['Extend hold period', 'Focus on value-add', 'Model different scenarios'],
    },
    {
      name: 'IRR (5yr)',
      value: irr,
      threshold: minIRR,
      passes: irr >= minIRR,
      comment: irr >= minIRR 
        ? 'Excellent projected internal rate of return' 
        : `Below ${minIRR}% target - review exit assumptions`,
      unit: '%',
      whyItMatters: 'Internal Rate of Return is the time-weighted total return including cash flow and appreciation.',
      lookForInOM: ['Recent comparable sales', 'Submarket appreciation forecasts'],
      whatToAdjust: ['Review exit cap rate assumptions', 'Model different hold periods'],
    },
    {
      name: 'Capital Returned',
      value: capitalReturned,
      threshold: minCapitalReturned,
      passes: capitalReturned >= minCapitalReturned,
      comment: capitalReturned >= minCapitalReturned 
        ? 'Good equity multiple at refinance' 
        : `Below ${minCapitalReturned}% - may take longer to return LP capital`,
      unit: '%',
      whyItMatters: 'Capital Returned at refinance shows how much of the initial investment comes back to investors.',
      lookForInOM: ['Forced appreciation opportunities', 'Cap rate compression potential'],
      whatToAdjust: ['Target higher refi LTV', 'Focus on NOI improvements before refi'],
    },
  ];
}

// Format helpers
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

// Deal Insights - Educational feedback for learning
export interface DealInsight {
  id: string;
  title: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  summary: string;
  whyItMatters: string;
  lookForInOM: string[];
  whatToAdjust: string[];
  targetValue?: string;
}

export function getDealInsights(inputs: PropertyInputs): DealInsight[] {
  const insights: DealInsight[] = [];
  const noi = calculateNOI(inputs);
  const egi = calculateEffectiveGrossIncome(inputs);
  const expenses = calculateOperatingExpenses(inputs);
  const fmv = calculateFairMarketValue(inputs);
  
  // Only generate insights if we have an asking price to evaluate against
  if (inputs.askingPrice <= 0) {
    return insights;
  }

  // 1. Cap Rate Check
  const askCapRate = (noi / inputs.askingPrice) * 100;
  if (askCapRate < inputs.marketCapRate) {
    const targetPrice = noi / (inputs.marketCapRate / 100);
    const capDiff = inputs.marketCapRate - askCapRate;
    const rentIncreaseNeeded = ((inputs.marketCapRate / askCapRate) - 1) * 100;
    
    insights.push({
      id: 'cap-rate-below-market',
      title: 'Cap Rate Below Market',
      severity: capDiff > 2 ? 'error' : 'warning',
      summary: `At asking, you're buying at a ${formatPercent(askCapRate)} cap vs ${formatPercent(inputs.marketCapRate)} market.`,
      whyItMatters: 'Cap rate represents your unleveraged return on investment. Buying below market cap means you\'re paying a premium for the property. This is only justified if there\'s clear value-add upside, below-market rents, or exceptional location/quality.',
      lookForInOM: [
        'Rent roll showing current rents vs market comparables',
        'Recent capital improvements that justify premium pricing',
        'Value-add opportunities (renovations, better management)',
        'Deferred maintenance that could explain below-market rents'
      ],
      whatToAdjust: [
        `Offer ${formatCurrency(targetPrice)} to hit ${formatPercent(inputs.marketCapRate)} cap rate`,
        `Or verify rents can increase ${formatPercent(rentIncreaseNeeded, 0)} to justify asking price`
      ],
      targetValue: formatCurrency(targetPrice)
    });
  }

  // 2. 1% Rule Check
  const onePercentRatio = (inputs.grossMonthlyRents / inputs.askingPrice) * 100;
  if (onePercentRatio < 1) {
    const targetPrice = inputs.grossMonthlyRents * 100;
    const targetRent = inputs.askingPrice * 0.01;
    
    insights.push({
      id: 'fails-1-percent-rule',
      title: 'Fails 1% Rule',
      severity: onePercentRatio < 0.8 ? 'error' : 'warning',
      summary: `Monthly rents are ${formatPercent(onePercentRatio, 2)} of asking price (target: 1%+).`,
      whyItMatters: 'The 1% rule is a quick filter: monthly rent should be at least 1% of purchase price. Properties below this often struggle to cash flow after financing. It\'s not absolute—some markets accept 0.8%—but below 1% warrants careful analysis.',
      lookForInOM: [
        'Current rent roll vs market rent comparables',
        'Lease expiration schedule for rent bump opportunities',
        'Below-market lease terms that can be corrected',
        'Utility billing opportunities (RUBS programs)'
      ],
      whatToAdjust: [
        `Offer ${formatCurrency(targetPrice)} to hit 1% rule`,
        `Or verify monthly rents can increase to ${formatCurrency(targetRent)}`
      ],
      targetValue: formatCurrency(targetPrice)
    });
  }

  // 3. GRM Check
  const askGRM = inputs.askingPrice / (inputs.grossMonthlyRents * 12);
  if (askGRM > 10) {
    const targetPrice = inputs.grossMonthlyRents * 12 * 10;
    
    insights.push({
      id: 'high-grm',
      title: askGRM > 12 ? 'GRM Too High' : 'GRM Elevated',
      severity: askGRM > 12 ? 'error' : 'warning',
      summary: `GRM of ${formatNumber(askGRM, 1)} means you're paying ${formatNumber(askGRM, 1)} years of gross rent. Target: <10.`,
      whyItMatters: 'Gross Rent Multiplier (GRM) shows how many years of gross rent equal the purchase price. Lower is better. A GRM above 10 suggests either premium pricing or value-add opportunity. Above 12 is concerning for most markets.',
      lookForInOM: [
        'Pro forma vs in-place rents (are projections realistic?)',
        'Comparable sales GRMs in the submarket',
        'Value-add potential to increase rents',
        'High vacancy or bad debt eating into effective income'
      ],
      whatToAdjust: [
        `Offer ${formatCurrency(targetPrice)} to achieve GRM of 10`,
        'Focus on rent increase potential to bring effective GRM down'
      ],
      targetValue: formatCurrency(targetPrice)
    });
  }

  // 4. FMV Gap Check
  const fmvGap = ((inputs.askingPrice - fmv) / inputs.askingPrice) * 100;
  if (fmvGap > 5) {
    insights.push({
      id: 'above-fmv',
      title: 'Priced Above Fair Market Value',
      severity: fmvGap > 15 ? 'error' : 'warning',
      summary: `Asking is ${formatPercent(fmvGap, 0)} above FMV (${formatCurrency(fmv)}).`,
      whyItMatters: 'Fair Market Value is calculated from NOI and cap rate. When asking price exceeds FMV, the seller is pricing in future appreciation or value-add you haven\'t verified. Make sure you\'re not paying for upside that may not materialize.',
      lookForInOM: [
        'Pro forma assumptions vs actual T12 performance',
        'Rent growth assumptions and market support',
        'Expense reduction claims and feasibility',
        'Recent comparable sales in the area'
      ],
      whatToAdjust: [
        `Offer at or near FMV: ${formatCurrency(fmv)}`,
        'Request seller to justify premium with verified upside'
      ],
      targetValue: formatCurrency(fmv)
    });
  }

  // 5. Expense Ratio Check
  const expenseRatio = (expenses / egi) * 100;
  if (expenseRatio < 40) {
    insights.push({
      id: 'low-expense-ratio',
      title: 'Expense Ratio Looks Optimistic',
      severity: expenseRatio < 35 ? 'error' : 'warning',
      summary: `${formatPercent(expenseRatio, 0)} expense ratio is below typical 40-50% range.`,
      whyItMatters: 'Most multifamily properties run 40-50% expense ratios. Below 40% often means the seller\'s T12 excludes management fees, reserves, or deferred maintenance. Your actual costs will likely be higher.',
      lookForInOM: [
        'Is professional management fee included (typically 5-8%)?',
        'Are replacement reserves included ($200-400/unit/year)?',
        'Check T12 for all expense categories (taxes, insurance, repairs)',
        'Look for deferred maintenance that will hit your budget'
      ],
      whatToAdjust: [
        'Rerun analysis using 45-50% expense ratio as reality check',
        'Request detailed expense breakdown from seller'
      ]
    });
  } else if (expenseRatio > 55) {
    insights.push({
      id: 'high-expense-ratio',
      title: 'High Expense Ratio',
      severity: 'info',
      summary: `${formatPercent(expenseRatio, 0)} expense ratio is above typical 40-50% range.`,
      whyItMatters: 'Higher than normal expenses could indicate poor management, deferred maintenance catching up, or accurate accounting. This could be a value-add opportunity if you can improve operations.',
      lookForInOM: [
        'Line-item expense breakdown to find outliers',
        'Management efficiency (in-house vs third-party)',
        'Utility costs and billing structure',
        'Maintenance history and deferred items'
      ],
      whatToAdjust: [
        'Identify specific expense reduction opportunities',
        'Model conservative case vs improved operations case'
      ]
    });
  }

  // 6. DSCR at Asking Check (using DSCR loan assumptions)
  const loanAtAsking = inputs.askingPrice * (inputs.ltv / 100);
  const paymentAtAsking = calculateMonthlyPayment(loanAtAsking, inputs.interestRate, inputs.amortizationYears) * 12;
  const dscrAtAsking = noi / paymentAtAsking;
  
  if (dscrAtAsking < 1.25) {
    // Calculate price where DSCR = 1.25
    const maxDebtService = noi / 1.25;
    const maxMonthlyPayment = maxDebtService / 12;
    // Work backwards to find max loan amount
    const monthlyRate = inputs.interestRate / 100 / 12;
    const numPayments = inputs.amortizationYears * 12;
    const maxLoan = maxMonthlyPayment * (Math.pow(1 + monthlyRate, numPayments) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, numPayments));
    const maxPurchasePrice = maxLoan / (inputs.ltv / 100);
    
    insights.push({
      id: 'low-dscr',
      title: 'DSCR Below Threshold',
      severity: dscrAtAsking < 1.0 ? 'error' : 'warning',
      summary: `DSCR of ${formatNumber(dscrAtAsking, 2)} at asking is below 1.25 lender minimum.`,
      whyItMatters: 'Debt Service Coverage Ratio measures how much cash flow covers your debt payment. Most lenders require 1.20-1.25 minimum. Below this, you\'ll either not qualify for the loan or need to bring more cash.',
      lookForInOM: [
        'NOI growth potential to improve DSCR over time',
        'Seller financing options with better terms',
        'Value-add opportunities to increase income',
        'Expense reduction possibilities'
      ],
      whatToAdjust: [
        `Offer ${formatCurrency(maxPurchasePrice)} to achieve 1.25 DSCR`,
        'Or negotiate seller financing with lower rate/longer amortization',
        'Or bring larger down payment to reduce loan amount'
      ],
      targetValue: formatCurrency(maxPurchasePrice)
    });
  }

  return insights;
}