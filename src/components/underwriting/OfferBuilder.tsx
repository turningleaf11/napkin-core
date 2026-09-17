import { useState, useCallback } from 'react';
import { BrokerFeedbackData } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { UnderwritingCalculations } from '../../hooks/useUnderwriting';
import { PropertyInputs, formatCurrency, formatPercent, formatNumber, OfferResult, calculateAcquisitionFee } from '../../lib/underwriting-calculations';
import { calculateOfferExitData } from '../../lib/exit-calculations';
import { MetricCard } from './MetricCard';
import { OfferExitSection } from './OfferExitSection';
import { SingleScenarioSolver } from './SingleScenarioSolver';
import { ScenarioReadiness } from './ScenarioReadiness';
import { BrokerFeedbackDialog } from './BrokerFeedbackDialog';
import { Landmark, Users, Layers, Download, MessageSquareText } from 'lucide-react';
import { StackMethodPanel } from './StackMethodPanel';
import { exportOffers } from '../../lib/export-offers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface OfferBuilderProps {
  inputs: PropertyInputs;
  calculations: UnderwritingCalculations;
  updateInput: <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) => void;
  dealId: string | null;
  brokerFeedback: BrokerFeedbackData | null;
  onSaveBrokerFeedback: (dealId: string, scenarioType: 'dscr' | 'seller', text: string) => Promise<boolean>;
  onSubTabChange?: (tab: string) => void;
  onEditCriteria?: () => void;
  // Forwarded to BrokerFeedbackDialog -- see its own props for why these
  // are the shell's responsibility, not this package's.
  brokerFeedbackEndpointUrl: string;
  getAuthToken: () => Promise<string | null | undefined>;
}

interface OfferBreakdownProps {
  offer: OfferResult;
  label: string;
  inputs: PropertyInputs;
  calculations: UnderwritingCalculations;
  interestRate: number;
  amortization: number;
  // Seller financing only: the note is due in full at this year. See OfferExitSection.
  balloonYears?: number;
}

// Compact inline input for offer tabs
interface InlineInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}

function InlineInput({ label, value, onChange, prefix, suffix, step = 1 }: InlineInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground whitespace-nowrap min-w-[80px]">{label}</Label>
      <div className="relative flex-1">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`h-7 text-xs ${prefix ? 'pl-5' : 'pl-2'} ${suffix ? 'pr-6' : 'pr-2'}`}
          step={step}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1 border-b border-border/50">
      {title}
    </div>
  );
}

function SummaryRow({ 
  label, 
  value, 
  isNegative = false, 
  isTotal = false,
  showPercent = false,
  percentValue = ''
}: { 
  label: string; 
  value: string; 
  isNegative?: boolean; 
  isTotal?: boolean;
  showPercent?: boolean;
  percentValue?: string;
}) {
  return (
    <div className={`flex justify-between items-center py-1 ${isTotal ? 'font-semibold border-t border-border/50 pt-2 mt-1' : ''}`}>
      <span className="text-xs text-muted-foreground">
        {label}
        {showPercent && percentValue && <span className="ml-1">({percentValue})</span>}
      </span>
      <span className={`text-sm font-medium ${isNegative ? 'text-red-600' : ''} ${isTotal ? 'text-primary' : ''}`}>
        {isNegative && !value.startsWith('(') && !value.startsWith('-') ? `(${value})` : value}
      </span>
    </div>
  );
}

// Editable version of SummaryRow for inline price editing
function EditableSummaryRow({
  label,
  value,
  onChange,
  isTotal = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  isTotal?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1 ${isTotal ? 'font-semibold border-t border-border/50 pt-2 mt-1' : ''}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-medium text-primary">$</span>
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          onFocus={(e) => e.target.select()}
          className="h-7 w-32 text-right text-sm font-medium pl-5 pr-2 bg-background border-primary/30 focus:border-primary"
        />
      </div>
    </div>
  );
}

interface OfferBreakdownWithPriceProps extends OfferBreakdownProps {
  offerPurchasePrice: number;
  onOfferPriceChange?: (price: number) => void;
}

function OfferBreakdown({ offer, label, inputs, calculations, interestRate, amortization, balloonYears, offerPurchasePrice, onOfferPriceChange }: OfferBreakdownWithPriceProps) {
  const { grossPotentialRent, vacancyLoss, concessionsLoss, noi, fairMarketValue } = calculations;

  // Calculate offer-specific cap rate using the scenario's offer price
  const offerCapRate = offerPurchasePrice > 0 ? (noi / offerPurchasePrice) * 100 : 0;
  const avgRentPerUnit = inputs.grossMonthlyRents / inputs.units;
  const cashFlowPerUnitMonth = (offer.cashFlow / inputs.units) / 12;
  const downPaymentPercent = offerPurchasePrice > 0 ? (offer.downPayment / offerPurchasePrice) * 100 : 0;
  const closingCostsAmount = offerPurchasePrice * (inputs.closingCostsPercent / 100);
  const acquisitionFeeAmount = calculateAcquisitionFee(inputs, offerPurchasePrice);
  // Investor-level cash-on-cash, the same figure the Offer Price Solver tests
  const { avgCashOnCash } = calculateOfferExitData(offer, inputs, interestRate, amortization, balloonYears);
  const askingDiscount = inputs.askingPrice > 0 && offerPurchasePrice > 0 
    ? ((inputs.askingPrice - offerPurchasePrice) / inputs.askingPrice) * 100 
    : 0;

  return (
    <div className="space-y-2">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricCard
          label="DSCR"
          value={formatNumber(offer.dscr, 2) + 'x'}
          status={offer.dscr >= inputs.minDSCR ? 'pass' : offer.dscr >= 1.0 ? 'warning' : 'fail'}
          size="sm"
        />
        <MetricCard
          label="Avg Cash on Cash (Members)"
          value={formatPercent(avgCashOnCash)}
          status={avgCashOnCash >= inputs.minCashOnCash ? 'pass' : avgCashOnCash >= inputs.minCashOnCash - 2 ? 'warning' : 'fail'}
          size="sm"
        />
      </div>

      {/* Acquisition Section */}
      <div className="border rounded-lg p-3 bg-muted/20 space-y-0">
        <SectionHeader title="Acquisition" />
        {inputs.askingPrice > 0 && (
          <>
            <SummaryRow label="Asking Price" value={formatCurrency(inputs.askingPrice)} />
            {onOfferPriceChange ? (
              <EditableSummaryRow 
                label="Your Offer Price" 
                value={offerPurchasePrice} 
                onChange={onOfferPriceChange}
                isTotal
              />
            ) : (
              <SummaryRow 
                label="Your Offer Price" 
                value={formatCurrency(offerPurchasePrice)} 
                isTotal
              />
            )}
            {askingDiscount > 0 && (
              <div className="text-xs text-green-600 font-medium pb-1">
                {formatPercent(askingDiscount)} below asking
              </div>
            )}
          </>
        )}
        {inputs.askingPrice === 0 && onOfferPriceChange && (
          <EditableSummaryRow 
            label="Purchase Price" 
            value={offerPurchasePrice} 
            onChange={onOfferPriceChange}
          />
        )}
        {inputs.askingPrice === 0 && !onOfferPriceChange && (
          <SummaryRow label="Purchase Price" value={formatCurrency(offerPurchasePrice)} />
        )}
        <SummaryRow label="Number of Units" value={inputs.units.toString()} />
        <SummaryRow 
          label="Down Payment" 
          value={formatCurrency(offer.downPayment)} 
          showPercent 
          percentValue={formatPercent(downPaymentPercent)} 
        />
        <SummaryRow label="Loan Amount" value={formatCurrency(offer.loanAmount)} />
        <SummaryRow label="Repairs" value={formatCurrency(inputs.repairs)} />
        <SummaryRow label="Operating Reserves" value={formatCurrency(inputs.operatingReserves)} />
        <SummaryRow 
          label="Closing Costs" 
          value={formatCurrency(closingCostsAmount)} 
          showPercent 
          percentValue={formatPercent(inputs.closingCostsPercent)} 
        />
        {acquisitionFeeAmount > 0 && (
          <SummaryRow 
            label="Acquisition Fee" 
            value={formatCurrency(acquisitionFeeAmount)} 
            showPercent 
            percentValue={formatPercent(inputs.acquisitionFeePercent)} 
          />
        )}
        <SummaryRow label="Total Capital Required" value={formatCurrency(offer.totalCapitalRequired)} isTotal />
      </div>

      {/* Income Section */}
      <div className="border rounded-lg p-3 bg-muted/20 space-y-0">
        <SectionHeader title="Income" />
        <SummaryRow label="Avg Monthly Rent/Unit" value={formatCurrency(avgRentPerUnit)} />
        <SummaryRow label="Gross Potential Rent" value={formatCurrency(grossPotentialRent)} />
        <SummaryRow 
          label="Less: Vacancy" 
          value={formatCurrency(vacancyLoss)} 
          isNegative 
          showPercent 
          percentValue={formatPercent(inputs.vacancyRate)} 
        />
        <SummaryRow 
          label="Less: Concessions/LTL" 
          value={formatCurrency(concessionsLoss)} 
          isNegative 
          showPercent 
          percentValue={formatPercent(inputs.concessionsRate)} 
        />
        {inputs.otherIncome > 0 && (
          <SummaryRow label="Other Income" value={formatCurrency(inputs.otherIncome)} />
        )}
        <SummaryRow label="Effective Gross Income" value={formatCurrency(calculations.effectiveGrossIncome)} isTotal />
      </div>

      {/* Expenses Section */}
      <div className="border rounded-lg p-3 bg-muted/20 space-y-0">
        <SectionHeader title="Expenses" />
        <SummaryRow 
          label="Total Expenses" 
          value={formatCurrency(calculations.operatingExpenses)} 
          isNegative 
          showPercent 
          percentValue={formatPercent(inputs.expenseRate)} 
        />
      </div>

      {/* Separate NOI Section */}
      <div className="border rounded-lg p-3 bg-primary/10 space-y-0">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Net Operating Income</span>
          <span className="text-sm font-bold text-primary">{formatCurrency(noi)}</span>
        </div>
      </div>

      {/* Financing & Returns Section */}
      <div className="border rounded-lg p-3 bg-muted/20 space-y-0">
        <SectionHeader title="Financing & Returns" />
        <SummaryRow label="Annual Debt Service" value={formatCurrency(offer.annualDebtService)} isNegative />
        <SummaryRow label="Interest Rate" value={formatPercent(interestRate)} />
        <SummaryRow label="Amortization" value={`${amortization} years`} />
        
        <div className={`flex justify-between items-center py-2 mt-2 rounded-lg px-2 ${offer.cashFlow >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
          <span className="text-xs font-medium">Cash Flow (After Debt)</span>
          <span className={`text-sm font-bold ${offer.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(offer.cashFlow)}
          </span>
        </div>
        
        <SummaryRow label="Cash Flow/Unit/Month" value={formatCurrency(cashFlowPerUnitMonth)} />
        
        <div className="border-t border-border/50 mt-2 pt-2">
          <SummaryRow label="Cap Rate" value={formatPercent(offerCapRate, 2)} />
          <SummaryRow label="DSCR" value={formatNumber(offer.dscr, 2) + 'x'} />
          <SummaryRow label="Fair Market Value" value={formatCurrency(fairMarketValue)} />
        </div>
      </div>
    </div>
  );
}

export function OfferBuilder({ inputs, calculations, updateInput, dealId, brokerFeedback, onSaveBrokerFeedback, onSubTabChange, onEditCriteria, brokerFeedbackEndpointUrl, getAuthToken }: OfferBuilderProps) {
  const { dscrOffer, sellerFinanceOffer, dscrSolverResult, sellerSolverResult } = calculations;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackScenario, setFeedbackScenario] = useState<'dscr' | 'seller'>('dscr');

  const handleSaveFeedback = useCallback(async (scenarioType: 'dscr' | 'seller', text: string) => {
    if (!dealId) return;
    await onSaveBrokerFeedback(dealId, scenarioType, text);
  }, [dealId, onSaveBrokerFeedback]);

  // Each scenario uses editable price, defaulting to asking price
  const dscrOfferPrice = inputs.dscrOfferPrice || inputs.askingPrice;
  const sellerOfferPrice = inputs.sellerOfferPrice || inputs.askingPrice;

  const openFeedback = (scenario: 'dscr' | 'seller') => {
    setFeedbackScenario(scenario);
    setFeedbackOpen(true);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="dscr" className="w-full" onValueChange={(v) => onSubTabChange?.(v)}>
        <div className="flex items-center gap-2">
          <TabsList className="grid flex-1 grid-cols-3 h-9">
            <TabsTrigger value="dscr" className="text-xs gap-1">
              <Landmark className="h-3 w-3" />
              DSCR
            </TabsTrigger>
            <TabsTrigger value="seller" className="text-xs gap-1">
              <Users className="h-3 w-3" />
              Seller
            </TabsTrigger>
            <TabsTrigger value="stack" className="text-xs gap-1">
              <Layers className="h-3 w-3" />
              Stack
            </TabsTrigger>
          </TabsList>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportOffers('dscr', inputs, calculations, brokerFeedback)}>
                DSCR Offer Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportOffers('seller', inputs, calculations, brokerFeedback)}>
                Seller Finance Only
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportOffers('both', inputs, calculations, brokerFeedback)}>
                Both Offers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TabsContent value="dscr" className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            <SingleScenarioSolver
              result={dscrSolverResult}
              askingPrice={inputs.askingPrice}
              onApply={(price) => updateInput('dscrOfferPrice', price)}
              onEditCriteria={onEditCriteria}
            />
            <button
              onClick={() => openFeedback('dscr')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <MessageSquareText className="h-4 w-4 text-primary" />
              <span className="text-xs">Broker Feedback</span>
            </button>
          </div>
          
          <Card className="mt-3">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">DSCR Loan + LP Capital</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Inline Financing Inputs */}
              <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-1">Financing Terms</div>
                <div className="grid grid-cols-2 gap-3">
                  <InlineInput
                    label="LTV"
                    value={inputs.ltv}
                    onChange={(v) => updateInput('ltv', v)}
                    suffix="%"
                    step={5}
                  />
                  <InlineInput
                    label="Rate"
                    value={inputs.interestRate}
                    onChange={(v) => updateInput('interestRate', v)}
                    suffix="%"
                    step={0.125}
                  />
                  <InlineInput
                    label="Amort (yrs)"
                    value={inputs.amortizationYears}
                    onChange={(v) => updateInput('amortizationYears', v)}
                    step={1}
                  />
                  <InlineInput
                    label="IO Months"
                    value={inputs.interestOnlyMonths}
                    onChange={(v) => updateInput('interestOnlyMonths', v)}
                    step={6}
                  />
                </div>
              </div>
              
              <OfferBreakdown 
                offer={dscrOffer} 
                label="DSCR Loan + LP Capital" 
                inputs={inputs}
                calculations={calculations}
                interestRate={inputs.interestRate}
                amortization={inputs.amortizationYears}
                offerPurchasePrice={dscrOfferPrice}
                onOfferPriceChange={(v) => updateInput('dscrOfferPrice', v)}
              />
              
              <OfferExitSection
                offer={dscrOffer}
                inputs={inputs}
                offerInterestRate={inputs.interestRate}
                offerAmortization={inputs.amortizationYears}
                updateInput={updateInput}
              />
              
              {/* Scenario-specific Deal Readiness */}
              <ScenarioReadiness
                inputs={inputs}
                offer={dscrOffer}
                offerPrice={dscrOfferPrice}
                scenario="dscr"
              />
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3 px-1">
            Traditional DSCR loan at {inputs.ltv}% LTV. LP capital covers down payment, repairs, reserves, and closing costs.
          </p>
        </TabsContent>

        <TabsContent value="seller" className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            <SingleScenarioSolver
              result={sellerSolverResult}
              askingPrice={inputs.askingPrice}
              onApply={(price) => updateInput('sellerOfferPrice', price)}
              onEditCriteria={onEditCriteria}
            />
            <button
              onClick={() => openFeedback('seller')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <MessageSquareText className="h-4 w-4 text-primary" />
              <span className="text-xs">Broker Feedback</span>
            </button>
          </div>
          
          <Card className="mt-3">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">Seller Financing</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Inline Financing Inputs */}
              <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
                <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-1">Seller Terms</div>
                <div className="grid grid-cols-2 gap-3">
                  <InlineInput
                    label="Down Pmt %"
                    value={inputs.sellerFinanceDownPaymentPercent}
                    onChange={(v) => updateInput('sellerFinanceDownPaymentPercent', v)}
                    suffix="%"
                    step={5}
                  />
                  <InlineInput
                    label="Rate"
                    value={inputs.sellerFinanceRate}
                    onChange={(v) => updateInput('sellerFinanceRate', v)}
                    suffix="%"
                    step={0.25}
                  />
                  <InlineInput
                    label="Amort (yrs)"
                    value={inputs.sellerFinanceAmortization}
                    onChange={(v) => updateInput('sellerFinanceAmortization', v)}
                    step={1}
                  />
                  <InlineInput
                    label="Balloon (yrs)"
                    value={inputs.sellerFinanceBalloonYears}
                    onChange={(v) => updateInput('sellerFinanceBalloonYears', v)}
                    step={1}
                  />
                </div>
              </div>
              
              <OfferBreakdown
                offer={sellerFinanceOffer}
                label="Seller Financing"
                inputs={inputs}
                calculations={calculations}
                interestRate={inputs.sellerFinanceRate}
                amortization={inputs.sellerFinanceAmortization}
                balloonYears={inputs.sellerFinanceBalloonYears}
                offerPurchasePrice={sellerOfferPrice}
                onOfferPriceChange={(v) => updateInput('sellerOfferPrice', v)}
              />

              <OfferExitSection
                offer={sellerFinanceOffer}
                inputs={inputs}
                offerInterestRate={inputs.sellerFinanceRate}
                offerAmortization={inputs.sellerFinanceAmortization}
                balloonYears={inputs.sellerFinanceBalloonYears}
                updateInput={updateInput}
              />
              
              {/* Scenario-specific Deal Readiness */}
              <ScenarioReadiness
                inputs={inputs}
                offer={sellerFinanceOffer}
                offerPrice={sellerOfferPrice}
                scenario="seller"
              />
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3 px-1">
            Seller carries {formatCurrency(sellerFinanceOffer.loanAmount)} at {inputs.sellerFinanceRate}% over {inputs.sellerFinanceAmortization} years 
            with {inputs.sellerFinanceBalloonYears}-year balloon.
          </p>
        </TabsContent>
        <TabsContent value="stack" className="mt-4">
          <StackMethodPanel inputs={inputs} updateInput={updateInput} onEditCriteria={onEditCriteria} />
        </TabsContent>
      </Tabs>

      <BrokerFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        inputs={inputs}
        calculations={calculations}
        scenarioType={feedbackScenario}
        dealId={dealId}
        savedFeedback={brokerFeedback?.[feedbackScenario] ?? null}
        onSaveFeedback={handleSaveFeedback}
        endpointUrl={brokerFeedbackEndpointUrl}
        getAuthToken={getAuthToken}
      />
    </div>
  );
}