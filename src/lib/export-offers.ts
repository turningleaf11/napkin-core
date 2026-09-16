import { PropertyInputs, OfferResult, formatCurrency, formatPercent, formatNumber } from './underwriting-calculations';
import { UnderwritingCalculations } from '../hooks/useUnderwriting';
import { BrokerFeedbackData } from '../types';

function buildOfferSummary(
  type: 'dscr' | 'seller' | 'both',
  inputs: PropertyInputs,
  calculations: UnderwritingCalculations,
): string {
  const lines: string[] = [];

  lines.push(`PROPERTY: ${inputs.propertyName || 'Untitled Deal'}`);
  if (inputs.propertyAddress) lines.push(`ADDRESS:  ${inputs.propertyAddress}`);
  lines.push(`UNITS:    ${inputs.units}`);
  lines.push(``);

  if (type === 'dscr' || type === 'both') {
    const dscrPrice = inputs.dscrOfferPrice || inputs.askingPrice;
    lines.push(`─── DSCR LOAN ─────────────────────────`);
    lines.push(`  Offer Price:       ${formatCurrency(dscrPrice)}`);
    lines.push(``);
  }

  if (type === 'seller' || type === 'both') {
    const sellerPrice = inputs.sellerOfferPrice || inputs.askingPrice;
    const offer = calculations.sellerFinanceOffer;
    const downPaymentPercent = sellerPrice > 0 ? (offer.downPayment / sellerPrice) * 100 : 0;
    const monthlyPayment = offer.annualDebtService / 12;

    lines.push(`─── SELLER FINANCING ──────────────────`);
    lines.push(`  Offer Price:       ${formatCurrency(sellerPrice)}`);
    lines.push(`  Down Payment:      ${formatCurrency(offer.downPayment)} (${formatPercent(downPaymentPercent)})`);
    lines.push(`  Seller Carry:      ${formatCurrency(offer.loanAmount)}`);
    lines.push(`  Interest Rate:     ${formatPercent(inputs.sellerFinanceRate)}`);
    lines.push(`  Amortization:      ${inputs.sellerFinanceAmortization} years`);
    lines.push(`  Monthly Payment:   ${formatCurrency(monthlyPayment)}`);
    lines.push(`  Balloon:           ${inputs.sellerFinanceBalloonYears} years`);
    lines.push(``);
  }

  return lines.join('\n');
}

function buildBrokerFeedbackSection(
  type: 'dscr' | 'seller' | 'both',
  brokerFeedback: BrokerFeedbackData | null,
): string {
  if (!brokerFeedback) return '';
  const hasDscr = (type === 'dscr' || type === 'both') && brokerFeedback.dscr;
  const hasSeller = (type === 'seller' || type === 'both') && brokerFeedback.seller;
  if (!hasDscr && !hasSeller) return '';

  const lines: string[] = [];
  lines.push(`─── BROKER FEEDBACK ───────────────────`);
  lines.push(``);

  if (hasDscr) {
    lines.push(`DSCR Loan:`);
    lines.push(brokerFeedback.dscr!);
    lines.push(``);
  }

  if (hasSeller) {
    lines.push(`Seller Finance:`);
    lines.push(brokerFeedback.seller!);
    lines.push(``);
  }

  return lines.join('\n');
}

function buildOfferText(
  title: string,
  offer: OfferResult,
  inputs: PropertyInputs,
  calculations: UnderwritingCalculations,
  offerPrice: number,
  interestRate: number,
  amortization: number,
): string {
  const { grossPotentialRent, vacancyLoss, concessionsLoss, noi, fairMarketValue } = calculations;
  const offerCapRate = offerPrice > 0 ? (noi / offerPrice) * 100 : 0;
  const avgRentPerUnit = inputs.grossMonthlyRents / inputs.units;
  const cashFlowPerUnitMonth = (offer.cashFlow / inputs.units) / 12;
  const downPaymentPercent = offerPrice > 0 ? (offer.downPayment / offerPrice) * 100 : 0;
  const closingCostsAmount = offerPrice * (inputs.closingCostsPercent / 100);
  const askingDiscount = inputs.askingPrice > 0 && offerPrice > 0
    ? ((inputs.askingPrice - offerPrice) / inputs.askingPrice) * 100
    : 0;

  const lines: string[] = [];
  lines.push(`═══════════════════════════════════════`);
  lines.push(`  ${title.toUpperCase()}`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(``);

  // Property Info
  lines.push(`PROPERTY`);
  lines.push(`────────────────────────────────────────`);
  if (inputs.propertyName) lines.push(`  Name:              ${inputs.propertyName}`);
  if (inputs.propertyAddress) lines.push(`  Address:           ${inputs.propertyAddress}`);
  lines.push(`  Units:             ${inputs.units}`);
  lines.push(``);

  // Key Metrics
  lines.push(`KEY METRICS`);
  lines.push(`────────────────────────────────────────`);
  lines.push(`  DSCR:              ${formatNumber(offer.dscr, 2)}x`);
  lines.push(`  Cash on Cash:      ${formatPercent(offer.cashOnCash)}`);
  lines.push(`  Cap Rate:          ${formatPercent(offerCapRate, 2)}`);
  lines.push(``);

  // Acquisition
  lines.push(`ACQUISITION`);
  lines.push(`────────────────────────────────────────`);
  if (inputs.askingPrice > 0) {
    lines.push(`  Asking Price:      ${formatCurrency(inputs.askingPrice)}`);
  }
  lines.push(`  Offer Price:       ${formatCurrency(offerPrice)}`);
  if (askingDiscount > 0) {
    lines.push(`  Discount:          ${formatPercent(askingDiscount)} below asking`);
  }
  lines.push(`  Down Payment:      ${formatCurrency(offer.downPayment)} (${formatPercent(downPaymentPercent)})`);
  lines.push(`  Loan Amount:       ${formatCurrency(offer.loanAmount)}`);
  lines.push(`  Repairs:           ${formatCurrency(inputs.repairs)}`);
  lines.push(`  Operating Reserves:${formatCurrency(inputs.operatingReserves)}`);
  lines.push(`  Closing Costs:     ${formatCurrency(closingCostsAmount)} (${formatPercent(inputs.closingCostsPercent)})`);
  lines.push(`  Total Capital Req: ${formatCurrency(offer.totalCapitalRequired)}`);
  lines.push(``);

  // Income
  lines.push(`INCOME`);
  lines.push(`────────────────────────────────────────`);
  lines.push(`  Avg Rent/Unit/Mo:  ${formatCurrency(avgRentPerUnit)}`);
  lines.push(`  Gross Potential:   ${formatCurrency(grossPotentialRent)}`);
  lines.push(`  Less Vacancy:      (${formatCurrency(vacancyLoss)}) @ ${formatPercent(inputs.vacancyRate)}`);
  lines.push(`  Less Concessions:  (${formatCurrency(concessionsLoss)}) @ ${formatPercent(inputs.concessionsRate)}`);
  if (inputs.otherIncome > 0) {
    lines.push(`  Other Income:      ${formatCurrency(inputs.otherIncome)}`);
  }
  lines.push(`  EGI:               ${formatCurrency(calculations.effectiveGrossIncome)}`);
  lines.push(``);

  // Expenses
  lines.push(`EXPENSES`);
  lines.push(`────────────────────────────────────────`);
  lines.push(`  Total Expenses:    (${formatCurrency(calculations.operatingExpenses)}) @ ${formatPercent(inputs.expenseRate)}`);
  lines.push(``);

  // NOI
  lines.push(`  NET OPERATING INCOME: ${formatCurrency(noi)}`);
  lines.push(``);

  // Financing
  lines.push(`FINANCING`);
  lines.push(`────────────────────────────────────────`);
  lines.push(`  Interest Rate:     ${formatPercent(interestRate)}`);
  lines.push(`  Amortization:      ${amortization} years`);
  lines.push(`  Annual Debt Svc:   (${formatCurrency(offer.annualDebtService)})`);
  lines.push(`  Cash Flow:         ${formatCurrency(offer.cashFlow)}`);
  lines.push(`  CF/Unit/Month:     ${formatCurrency(cashFlowPerUnitMonth)}`);
  lines.push(`  Fair Market Value: ${formatCurrency(fairMarketValue)}`);
  lines.push(``);

  return lines.join('\n');
}

export function exportOffers(
  type: 'dscr' | 'seller' | 'both',
  inputs: PropertyInputs,
  calculations: UnderwritingCalculations,
  brokerFeedback: BrokerFeedbackData | null = null,
) {
  const sections: string[] = [];
  const date = new Date().toLocaleDateString();

  sections.push(`OFFER SUMMARY — ${date}`);
  sections.push(`Generated by Napkin`);
  sections.push(``);

  // Offer summary block
  sections.push(buildOfferSummary(type, inputs, calculations));

  // Broker feedback block
  const feedbackSection = buildBrokerFeedbackSection(type, brokerFeedback);
  if (feedbackSection) {
    sections.push(feedbackSection);
  }

  if (type === 'dscr' || type === 'both') {
    const dscrPrice = inputs.dscrOfferPrice || inputs.askingPrice;
    sections.push(buildOfferText(
      'DSCR Loan + LP Capital',
      calculations.dscrOffer,
      inputs,
      calculations,
      dscrPrice,
      inputs.interestRate,
      inputs.amortizationYears,
    ));
  }

  if (type === 'seller' || type === 'both') {
    const sellerPrice = inputs.sellerOfferPrice || inputs.askingPrice;
    sections.push(buildOfferText(
      'Seller Financing',
      calculations.sellerFinanceOffer,
      inputs,
      calculations,
      sellerPrice,
      inputs.sellerFinanceRate,
      inputs.sellerFinanceAmortization,
    ));
  }

  const content = sections.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = inputs.propertyName || 'Deal';
  a.href = url;
  a.download = `${name} - Offer Summary.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
