import { PropertyInputs, calculateNOI, calculateFairMarketValue } from './underwriting-calculations';
import { UnderwritingCalculations } from '../hooks/useUnderwriting';

export interface BrokerFeedbackPayload {
  propertyName: string;
  propertyAddress: string;
  units: number;
  scenarioType: 'dscr' | 'seller';
  askingPrice: number;
  offerPrice: number;
  discountPercent: number;
  pricePerUnit: number;
  capRateAtAsking: number;
  capRateAtOffer: number;
  marketCapRate: number;
  fairMarketValue: number;
  fmvVsAsking: string;
  grmAtAsking: number;
  grmAtOffer: number;
  passes1PercentRule: boolean;
  grossMonthlyRents: number;
  noi: number;
  expenseRatio: number;
  dscrAtOffer: number;
  annualDebtService: number;
  cashFlow: number;
  cashOnCash: number;
  interestRate: number;
  amortization: number;
  ltv?: number;
  downPaymentPercent?: number;
  balloonYears?: number;
}

export function prepareBrokerFeedbackPayload(
  inputs: PropertyInputs,
  calculations: UnderwritingCalculations,
  scenarioType: 'dscr' | 'seller'
): BrokerFeedbackPayload {
  const noi = calculateNOI(inputs);
  const fmv = calculateFairMarketValue(inputs);
  const grossAnnual = inputs.grossMonthlyRents * 12;

  const offerPrice = scenarioType === 'dscr'
    ? (inputs.dscrOfferPrice || inputs.askingPrice)
    : (inputs.sellerOfferPrice || inputs.askingPrice);

  const offer = scenarioType === 'dscr' ? calculations.dscrOffer : calculations.sellerFinanceOffer;

  const capRateAtAsking = inputs.askingPrice > 0 ? (noi / inputs.askingPrice) * 100 : 0;
  const capRateAtOffer = offerPrice > 0 ? (noi / offerPrice) * 100 : 0;
  const discountPercent = inputs.askingPrice > 0
    ? ((inputs.askingPrice - offerPrice) / inputs.askingPrice) * 100
    : 0;

  const fmvDiff = fmv - inputs.askingPrice;
  const fmvVsAsking = fmvDiff >= 0
    ? `FMV is $${Math.abs(fmvDiff).toLocaleString()} above asking`
    : `FMV is $${Math.abs(fmvDiff).toLocaleString()} below asking`;

  const grmAtAsking = inputs.askingPrice > 0 && grossAnnual > 0 ? inputs.askingPrice / grossAnnual : 0;
  const grmAtOffer = offerPrice > 0 && grossAnnual > 0 ? offerPrice / grossAnnual : 0;
  const passes1PercentRule = offerPrice > 0 ? (inputs.grossMonthlyRents / offerPrice) >= 0.01 : false;

  const base: BrokerFeedbackPayload = {
    propertyName: inputs.propertyName,
    propertyAddress: inputs.propertyAddress,
    units: inputs.units,
    scenarioType,
    askingPrice: inputs.askingPrice,
    offerPrice,
    discountPercent,
    pricePerUnit: offerPrice / inputs.units,
    capRateAtAsking,
    capRateAtOffer,
    marketCapRate: inputs.marketCapRate,
    fairMarketValue: fmv,
    fmvVsAsking,
    grmAtAsking,
    grmAtOffer,
    passes1PercentRule,
    grossMonthlyRents: inputs.grossMonthlyRents,
    noi,
    expenseRatio: inputs.expenseRate,
    dscrAtOffer: offer.dscr,
    annualDebtService: offer.annualDebtService,
    cashFlow: offer.cashFlow,
    cashOnCash: offer.cashOnCash,
    interestRate: scenarioType === 'dscr' ? inputs.interestRate : inputs.sellerFinanceRate,
    amortization: scenarioType === 'dscr' ? inputs.amortizationYears : inputs.sellerFinanceAmortization,
  };

  if (scenarioType === 'dscr') {
    base.ltv = inputs.ltv;
  } else {
    base.downPaymentPercent = inputs.sellerFinanceDownPaymentPercent;
    base.balloonYears = inputs.sellerFinanceBalloonYears;
  }

  return base;
}

export async function streamBrokerFeedback({
  endpointUrl,
  getAuthToken,
  dealMetrics,
  onDelta,
  onDone,
  onError,
}: {
  // Full URL of the shell's own broker-feedback endpoint. Each shell (the
  // standalone app, OpsHQ) points this at its own edge function -- this
  // package has no opinion on which backend or AI provider serves it.
  endpointUrl: string;
  // Resolves the current user's auth token fresh on every call (tokens
  // expire/refresh), scoped however the shell's own auth system works.
  // Returning null/undefined means "not signed in".
  getAuthToken: () => Promise<string | null | undefined>;
  dealMetrics: BrokerFeedbackPayload;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const token = await getAuthToken();
    if (!token) {
      onError("You must be signed in to generate broker feedback.");
      return;
    }

    const resp = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ dealMetrics }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: "Request failed" }));
      onError(errorData.error || `Error ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response stream");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
