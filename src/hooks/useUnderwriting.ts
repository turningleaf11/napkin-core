import { useState, useMemo } from 'react';
import {
  PropertyInputs,
  defaultInputs,
  calculateNOI,
  calculateFairMarketValue,
  calculateCapRate,
  calculateGRM,
  check1PercentRule,
  calculateDSCR,
  calculateCashFlow,
  calculateTotalCapitalRequired,
  calculateCashOnCash,
  calculatePricePerUnit,
  calculateRentPerUnit,
  calculateNOIPerUnit,
  calculateAnnualDebtService,
  calculateEffectiveGrossIncome,
  calculateOperatingExpenses,
  calculateLoanAmount,
  calculateDownPayment,
  calculateGrossAnnualIncome,
  calculateGrossPotentialRent,
  calculateVacancyLoss,
  calculateConcessionsLoss,
  calculateClosingCostsAmount,
  calculateOfferAtPrice,
} from '../lib/underwriting-calculations';
import { solveMaxDSCROffer, solveMaxSellerFinanceOffer } from '../lib/scenario-analysis';

export function useUnderwriting() {
  const [inputs, setInputs] = useState<PropertyInputs>(defaultInputs);

  const updateInput = <K extends keyof PropertyInputs>(
    key: K,
    value: PropertyInputs[K]
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateInputs = (updates: Partial<PropertyInputs>) => {
    setInputs((prev) => ({ ...prev, ...updates }));
  };

  const resetInputs = () => {
    setInputs(defaultInputs);
  };

  // All calculated values
  const calculations = useMemo(() => {
    const grossAnnualIncome = calculateGrossAnnualIncome(inputs);
    const effectiveGrossIncome = calculateEffectiveGrossIncome(inputs);
    const operatingExpenses = calculateOperatingExpenses(inputs);
    const noi = calculateNOI(inputs);
    const fairMarketValue = calculateFairMarketValue(inputs);
    const capRate = calculateCapRate(inputs);
    const grm = calculateGRM(inputs);
    const passes1PercentRule = check1PercentRule(inputs);
    const loanAmount = calculateLoanAmount(inputs);
    const downPayment = calculateDownPayment(inputs);
    const annualDebtService = calculateAnnualDebtService(inputs);
    const dscr = calculateDSCR(inputs);
    const cashFlow = calculateCashFlow(inputs);
    const totalCapitalRequired = calculateTotalCapitalRequired(inputs);
    const cashOnCash = calculateCashOnCash(inputs);

    // Overview-specific calculations using askingPrice as base
    const overviewLoanAmount = inputs.askingPrice * (inputs.ltv / 100);
    const overviewDownPayment = inputs.askingPrice * (1 - inputs.ltv / 100);
    const overviewMonthlyPayment = overviewLoanAmount > 0 
      ? (overviewLoanAmount * (inputs.interestRate / 100 / 12) * Math.pow(1 + inputs.interestRate / 100 / 12, inputs.amortizationYears * 12)) /
        (Math.pow(1 + inputs.interestRate / 100 / 12, inputs.amortizationYears * 12) - 1)
      : 0;
    const overviewAnnualDebtService = overviewMonthlyPayment * 12;
    const overviewClosingCosts = inputs.askingPrice * (inputs.closingCostsPercent / 100);
    const overviewTotalCapitalRequired = overviewDownPayment + inputs.repairs + inputs.operatingReserves + overviewClosingCosts;
    const overviewCashFlow = noi - overviewAnnualDebtService;
    const overviewPricePerUnit = inputs.askingPrice / inputs.units;

    // Per unit (overview is priced at the asking price)
    const pricePerUnit = calculatePricePerUnit(inputs);
    const rentPerUnit = calculateRentPerUnit(inputs);
    const noiPerUnit = calculateNOIPerUnit(inputs);
    const debtServicePerUnit = inputs.units > 0 ? overviewAnnualDebtService / inputs.units : 0;
    const cashFlowPerUnit = inputs.units > 0 ? overviewCashFlow / inputs.units : 0;

    // Offer solvers - calculate max prices first
    const dscrSolverResult = solveMaxDSCROffer(inputs);
    const sellerSolverResult = solveMaxSellerFinanceOffer(inputs);

    // Scenario prices: use explicit price if set, otherwise fall back to asking price
    const dscrPrice = inputs.dscrOfferPrice || inputs.askingPrice;
    const sellerPrice = inputs.sellerOfferPrice || inputs.askingPrice;
    const subtoPrice = inputs.subtoOfferPrice || inputs.askingPrice;
    const hybridPrice = inputs.hybridOfferPrice || inputs.askingPrice;

    // Offer types - calculated at scenario-specific prices
    const dscrOffer = calculateOfferAtPrice(inputs, dscrPrice, 'dscr');
    const sellerFinanceOffer = calculateOfferAtPrice(inputs, sellerPrice, 'seller');
    const subjectToOffer = calculateOfferAtPrice(inputs, subtoPrice, 'subto');
    const hybridOffer = calculateOfferAtPrice(inputs, hybridPrice, 'hybrid');


    // Display helpers for offer summary
    const grossPotentialRent = calculateGrossPotentialRent(inputs);
    const vacancyLoss = calculateVacancyLoss(inputs);
    const concessionsLoss = calculateConcessionsLoss(inputs);
    const closingCostsAmount = calculateClosingCostsAmount(inputs);

    return {
      grossAnnualIncome,
      effectiveGrossIncome,
      operatingExpenses,
      noi,
      fairMarketValue,
      capRate,
      grm,
      passes1PercentRule,
      loanAmount,
      downPayment,
      annualDebtService,
      dscr,
      cashFlow,
      totalCapitalRequired,
      cashOnCash,
      pricePerUnit,
      rentPerUnit,
      noiPerUnit,
      debtServicePerUnit,
      cashFlowPerUnit,
      dscrOffer,
      sellerFinanceOffer,
      subjectToOffer,
      hybridOffer,
      dscrSolverResult,
      sellerSolverResult,
      // Display helpers
      grossPotentialRent,
      vacancyLoss,
      concessionsLoss,
      closingCostsAmount,
      // Overview-specific (asking price based)
      overviewLoanAmount,
      overviewDownPayment,
      overviewAnnualDebtService,
      overviewTotalCapitalRequired,
      overviewCashFlow,
      overviewPricePerUnit,
    };
  }, [inputs]);

  return {
    inputs,
    setInputs,
    updateInput,
    updateInputs,
    resetInputs,
    calculations,
  };
}

export type UnderwritingCalculations = ReturnType<typeof useUnderwriting>['calculations'];
