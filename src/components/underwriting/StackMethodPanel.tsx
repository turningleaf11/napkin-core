import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { PropertyInputs, formatCurrency, formatPercent, formatNumber } from '../../lib/underwriting-calculations';
import { StackReadinessMetric, calculateStackDeal, getStackReadiness, solveMaxStackOffer, stackPriceFor } from '../../lib/stack-calculations';
import { SingleScenarioSolver } from './SingleScenarioSolver';
import { Layers, ArrowDown, DollarSign, TrendingUp, Target, ChevronDown, CheckCircle2, XCircle, Lightbulb, Search, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StackMethodPanelProps {
  inputs: PropertyInputs;
  updateInput: <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) => void;
  onEditCriteria?: () => void;
}

function StackInput({ label, value, onChange, prefix, suffix, step = 1, minWidth = '80px' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  minWidth?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground whitespace-nowrap" style={{ minWidth }}>{label}</Label>
      <div className="relative flex-1">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`h-8 text-xs ${prefix ? 'pl-5' : 'pl-2'} ${suffix ? 'pr-6' : 'pr-2'}`}
          step={step}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function StackRow({ label, value, isNegative, isTotal, highlight, className = '' }: {
  label: string;
  value: string;
  isNegative?: boolean;
  isTotal?: boolean;
  highlight?: 'green' | 'primary';
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center py-1 ${isTotal ? 'font-semibold border-t border-border/50 pt-2 mt-1' : ''} ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${isNegative ? 'text-red-600' : ''} ${highlight === 'green' ? 'text-green-600 font-bold' : ''} ${highlight === 'primary' ? 'text-primary font-bold' : ''} ${isTotal && !highlight ? 'text-primary' : ''}`}>
        {isNegative && !value.startsWith('-') && !value.startsWith('(') ? `(${value})` : value}
      </span>
    </div>
  );
}

function StackSectionHeader({ title }: { title: string }) {
  return (
    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1 border-b border-border/50">
      {title}
    </div>
  );
}

function StackReadinessRow({ metric }: { metric: StackReadinessMetric }) {
  const [isOpen, setIsOpen] = useState(false);

  if (metric.pass) {
    return (
      <div className="flex items-center gap-1.5 py-1 px-1.5">
        <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
        <span className="text-[10px] font-medium flex-1 truncate">{metric.name}</span>
        <span className="text-[10px] text-muted-foreground">{metric.formatted}</span>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          'flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-muted/50 transition-colors',
          isOpen && 'bg-rose-500/5'
        )}>
          <XCircle className="h-3 w-3 text-rose-500 flex-shrink-0" />
          <span className="text-[10px] font-medium text-left flex-1 truncate">
            {metric.name} — {metric.formatted}
          </span>
          <ChevronDown className={cn('h-2.5 w-2.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-5 pr-1.5 pb-1.5 space-y-1.5 text-[10px]">
          <p className="text-muted-foreground">{metric.comment}</p>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 font-medium text-muted-foreground">
              <Lightbulb className="h-2.5 w-2.5" />
              Why it matters
            </div>
            <p className="text-foreground/80">{metric.whyItMatters}</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 font-medium text-muted-foreground">
              <Search className="h-2.5 w-2.5" />
              Look for in OM
            </div>
            <p className="text-foreground/80">{metric.lookForInOM}</p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 font-medium text-muted-foreground">
              <Wrench className="h-2.5 w-2.5" />
              What to adjust
            </div>
            <p className="text-foreground/80">{metric.whatToAdjust}</p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function StackMethodPanel({ inputs, updateInput, onEditCriteria }: StackMethodPanelProps) {
  // Read from global inputs (with fallbacks for first load)
  const purchasePrice = stackPriceFor(inputs);
  const sellerFinancePct = inputs.stackSellerFinancePct;
  const sellerClosingCostsPct = inputs.stackSellerClosingCostsPct;
  const reCommissionPct = inputs.stackReCommissionPct;
  const outstandingLoan = inputs.stackOutstandingLoan;
  const loanLtvPct = inputs.stackLoanLtvPct;
  const buyerClosingCostsPct = inputs.stackBuyerClosingCostsPct;
  const originationFeePct = inputs.stackOriginationFeePct;
  const tfFeePct = inputs.stackTfFeePct;
  const firstLienRate = inputs.stackFirstLienRate;
  const firstLienAmort = inputs.stackFirstLienAmort;
  const secondLienRate = inputs.stackSecondLienRate;
  const secondLienAmort = inputs.stackSecondLienAmort;
  const units = inputs.stackUnits;
  const avgRentPerUnit = inputs.stackAvgRentPerUnit;
  const occupancyPct = inputs.stackOccupancyPct;
  const propMgmtPct = inputs.stackPropMgmtPct;
  const maintenanceReservePct = inputs.stackMaintenanceReservePct;
  const insuranceMo = inputs.stackInsuranceMo;
  const taxesMo = inputs.stackTaxesMo;
  const utilitiesMo = inputs.stackUtilitiesMo;
  const refiYear = inputs.stackRefiYear;
  const saleYear = inputs.stackSaleYear;
  const exitCapRate = inputs.stackExitCapRate;
  const capRateIncreasePerYear = inputs.stackCapRateIncreasePerYear;
  const refiLTV = inputs.stackRefiLTV;
  const refiRate = inputs.stackRefiRate;
  const refiAmort = inputs.stackRefiAmort;
  const refiCostsPct = inputs.stackRefiCostsPct;
  const sellingCostsPct = inputs.stackSellingCostsPct;
  const prepayPenaltyPct = inputs.stackPrepayPenaltyPct;
  const rentGrowthPct = inputs.stackRentGrowthPct;

  const [exitAssumptionsOpen, setExitAssumptionsOpen] = useState(false);

  // Sync purchase price from asking price when it changes (only if stack price hasn't been manually set)
  useEffect(() => {
    if (inputs.askingPrice > 0 && inputs.stackPurchasePrice === 0) {
      updateInput('stackPurchasePrice', inputs.askingPrice);
    }
  }, [inputs.askingPrice]);

  // Sync units from main inputs when they change (only if stack units are at default)
  useEffect(() => {
    if (inputs.units > 0 && inputs.stackUnits === 10 && inputs.units !== 10) {
      updateInput('stackUnits', inputs.units);
    }
  }, [inputs.units]);

  const calc = useMemo(() => calculateStackDeal(inputs, purchasePrice), [inputs, purchasePrice]);

  // === DEAL READINESS ===
  const readinessMetrics = useMemo(() => getStackReadiness(inputs, calc), [inputs, calc]);

  const solverResult = useMemo(() => solveMaxStackOffer(inputs), [inputs]);

  const passingCount = readinessMetrics.filter(m => m.pass).length;
  const allPass = passingCount === readinessMetrics.length;

  return (
    <div className="space-y-4">
      <SingleScenarioSolver
        result={solverResult}
        askingPrice={inputs.askingPrice}
        onApply={(price) => updateInput('stackPurchasePrice', price)}
        onEditCriteria={onEditCriteria}
      />

      {/* CARD 1: Flow of Funds */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Flow of Funds
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Seller Box */}
            <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
              <StackSectionHeader title="Seller" />
              <StackInput label="Purchase Price" value={purchasePrice} onChange={(v) => updateInput("stackPurchasePrice", v)} prefix="$" step={10000} minWidth="95px" />
              <StackInput label="Seller Carry %" value={sellerFinancePct} onChange={(v) => updateInput("stackSellerFinancePct", v)} suffix="%" step={5} minWidth="95px" />
              <StackInput label="Closing Costs %" value={sellerClosingCostsPct} onChange={(v) => updateInput("stackSellerClosingCostsPct", v)} suffix="%" step={0.5} minWidth="95px" />
              <StackInput label="RE Commission %" value={reCommissionPct} onChange={(v) => updateInput("stackReCommissionPct", v)} suffix="%" step={0.5} minWidth="95px" />
              <StackInput label="Existing Loan" value={outstandingLoan} onChange={(v) => updateInput("stackOutstandingLoan", v)} prefix="$" step={10000} minWidth="95px" />
              <div className="pt-2 border-t border-border/50 space-y-0">
                <StackRow label="Carry Amount (2nd Lien)" value={formatCurrency(calc.sellerFinanceAmt)} />
                <StackRow label="Closing Costs" value={formatCurrency(calc.sellerClosingCosts)} isNegative />
                <StackRow label="RE Commission" value={formatCurrency(calc.reCommission)} isNegative />
                <StackRow label="Loan Payoff" value={formatCurrency(outstandingLoan)} isNegative={outstandingLoan > 0} />
              </div>
              <div className="border-t border-border/50 pt-2 space-y-0">
                <StackRow label="Net Cash at Close" value={formatCurrency(calc.sellerNetCash)} isTotal highlight={calc.sellerNetCash >= 0 ? 'green' : undefined} />
                <StackRow label="Seller Note (2nd Lien)" value={formatCurrency(calc.sellerFinanceAmt)} />
                <StackRow label="Total Consideration" value={formatCurrency(calc.sellerNetCash + calc.sellerFinanceAmt)} isTotal />
              </div>
            </div>

            {/* Buyer Box */}
            <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
              <StackSectionHeader title="Buyer" />
              <StackInput label="1st Loan LTV %" value={loanLtvPct} onChange={(v) => updateInput("stackLoanLtvPct", v)} suffix="%" step={5} minWidth="95px" />
              <StackInput label="Closing Costs %" value={buyerClosingCostsPct} onChange={(v) => updateInput("stackBuyerClosingCostsPct", v)} suffix="%" step={0.5} minWidth="95px" />
              <StackInput label="Origination %" value={originationFeePct} onChange={(v) => updateInput("stackOriginationFeePct", v)} suffix="%" step={0.25} minWidth="95px" />
              <div className="pt-2 border-t border-border/50 space-y-0">
                <StackRow label="1st Loan Amount" value={formatCurrency(calc.loanAmount)} />
                <StackRow label="Down Payment" value={formatCurrency(calc.downPayment)} />
                <StackRow label="Closing Costs" value={formatCurrency(calc.buyerClosingCosts)} isNegative />
                <StackRow label="Origination Fee" value={formatCurrency(calc.originationFee)} isNegative />
                <StackRow label="Total Cost to Close" value={formatCurrency(calc.buyerTotalCostToClose)} isTotal />
              </div>
              <div className="border-t border-border/50 pt-2 space-y-0">
                <StackRow label="Walk-Away Cash" value={formatCurrency(calc.buyerWalkAwayCash)} highlight={calc.buyerWalkAwayCash >= 0 ? 'green' : undefined} />
                <div className="mt-1 px-2 py-1.5 rounded bg-green-50 dark:bg-green-950/30 text-center">
                  <span className="text-xs font-bold text-green-600">Buyer Brings: $0</span>
                </div>
              </div>
            </div>

            {/* TF Box */}
            <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
              <StackSectionHeader title="Transactional Funder" />
              <StackInput label="TF Fee %" value={tfFeePct} onChange={(v) => updateInput("stackTfFeePct", v)} suffix="%" step={0.5} minWidth="95px" />
              <div className="pt-2 border-t border-border/50 space-y-0">
                <StackRow label="Funding Amount" value={formatCurrency(calc.tfFundingAmount)} />
                <StackRow label="TF Fee" value={formatCurrency(calc.tfFee)} />
              </div>
              <div className="border-t border-border/50 pt-2 space-y-0">
                <StackRow label="Principal Returned" value={formatCurrency(calc.tfFundingAmount)} />
                <StackRow label="Fee Earned" value={formatCurrency(calc.tfFee)} highlight="green" />
                <StackRow label="Total Payback" value={formatCurrency(calc.tfTotalPayback)} isTotal />
              </div>
            </div>

          </div>

          {/* Escrow Summary — Full Width */}
          <div className="border rounded-lg p-4 bg-primary/5 space-y-2">
            <StackSectionHeader title="Escrow Summary" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-0">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">Sources</div>
                <StackRow label="1st Loan Proceeds" value={formatCurrency(calc.loanAmount)} />
                <StackRow label="TF Funding" value={formatCurrency(calc.tfFundingAmount)} />
                <StackRow label="Total Funds In" value={formatCurrency(calc.escrowTotalIn)} isTotal highlight="primary" />
              </div>
              <div className="space-y-0">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">Uses</div>
                <StackRow label="→ Seller (payoff + costs + cash)" value={formatCurrency(outstandingLoan + calc.sellerClosingCosts + calc.reCommission + Math.max(calc.sellerNetCash, 0))} isNegative />
                <StackRow label="→ Buyer (costs + origination)" value={formatCurrency(calc.buyerClosingCosts + calc.originationFee)} isNegative />
                <StackRow label="→ TF (principal + fee)" value={formatCurrency(calc.tfTotalPayback)} isNegative />
              </div>
            </div>
            <div className="border-t border-border/50 pt-2 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StackRow label="Buyer Walk-Away" value={formatCurrency(calc.buyerWalkAwayCash)} isTotal highlight={calc.buyerWalkAwayCash >= 0 ? 'green' : undefined} />
                <div className="space-y-0">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">Property Liens</div>
                  <StackRow label={`1st Lien (${formatPercent(calc.firstLienLtv)} LTV)`} value={formatCurrency(calc.firstLienAmt)} />
                  <StackRow label={`2nd Lien (${formatPercent(calc.secondLienLtv)} LTV)`} value={formatCurrency(calc.secondLienAmt)} />
                  <StackRow label="Combined LTV" value={formatPercent(calc.combinedLtv)} isTotal highlight={calc.combinedLtv <= 100 ? 'green' : undefined} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD 3: Cashflow Analysis */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Cashflow Analysis (Rental Hold)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="border rounded-lg p-3 bg-primary/5 space-y-2">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-1">Debt Service</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-1">1st Position (Lender)</div>
                <StackInput label="Rate" value={firstLienRate} onChange={(v) => updateInput("stackFirstLienRate", v)} suffix="%" step={0.125} minWidth="70px" />
                <StackInput label="Amort (yrs)" value={firstLienAmort} onChange={(v) => updateInput("stackFirstLienAmort", v)} step={1} minWidth="70px" />
                <div className="pt-1 text-xs text-muted-foreground">
                  Monthly: <span className="font-medium text-foreground">{formatCurrency(calc.firstPmtMo)}</span>
                  <span className="mx-1">•</span>
                  Yearly: <span className="font-medium text-foreground">{formatCurrency(calc.firstPmtMo * 12)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-1">2nd Position (Seller)</div>
                <StackInput label="Rate" value={secondLienRate} onChange={(v) => updateInput("stackSecondLienRate", v)} suffix="%" step={0.25} minWidth="70px" />
                <StackInput label="Amort (yrs)" value={secondLienAmort} onChange={(v) => updateInput("stackSecondLienAmort", v)} step={1} minWidth="70px" />
                <div className="pt-1 text-xs text-muted-foreground">
                  Monthly: <span className="font-medium text-foreground">{formatCurrency(calc.secondPmtMo)}</span>
                  <span className="mx-1">•</span>
                  Yearly: <span className="font-medium text-foreground">{formatCurrency(calc.secondPmtMo * 12)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-border/50 pt-2 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Combined Debt Service</span>
                <span>
                  <span className="font-medium text-foreground">{formatCurrency(calc.combinedPmtMo)}</span>/mo
                  <span className="mx-1">•</span>
                  <span className="font-medium text-foreground">{formatCurrency(calc.combinedPmtMo * 12)}</span>/yr
                </span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
            <StackSectionHeader title="Income" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StackInput label="Units" value={units} onChange={(v) => updateInput("stackUnits", v)} step={1} minWidth="70px" />
              <StackInput label="Avg Rent/Unit" value={avgRentPerUnit} onChange={(v) => updateInput("stackAvgRentPerUnit", v)} prefix="$" step={25} minWidth="70px" />
              <StackInput label="Occupancy %" value={occupancyPct} onChange={(v) => updateInput("stackOccupancyPct", v)} suffix="%" step={1} minWidth="70px" />
            </div>
            <div className="pt-2 border-t border-border/50 space-y-0">
              <StackRow label="Gross Rent (Monthly)" value={formatCurrency(calc.grossRentMo)} />
              <StackRow label="Effective Rent (Monthly)" value={formatCurrency(calc.effectiveRentMo)} />
              <StackRow label="Effective Rent (Yearly)" value={formatCurrency(calc.effectiveRentYr)} isTotal />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
            <StackSectionHeader title="Expenses" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StackInput label="Property Mgmt %" value={propMgmtPct} onChange={(v) => updateInput("stackPropMgmtPct", v)} suffix="%" step={1} minWidth="100px" />
              <StackInput label="Maint Reserve %" value={maintenanceReservePct} onChange={(v) => updateInput("stackMaintenanceReservePct", v)} suffix="%" step={1} minWidth="100px" />
              <StackInput label="Insurance/mo" value={insuranceMo} onChange={(v) => updateInput("stackInsuranceMo", v)} prefix="$" step={50} minWidth="100px" />
              <StackInput label="Taxes/mo" value={taxesMo} onChange={(v) => updateInput("stackTaxesMo", v)} prefix="$" step={50} minWidth="100px" />
              <StackInput label="Utilities/mo" value={utilitiesMo} onChange={(v) => updateInput("stackUtilitiesMo", v)} prefix="$" step={50} minWidth="100px" />
            </div>
            <div className="pt-2 border-t border-border/50 space-y-0">
              <StackRow label="Property Mgmt" value={formatCurrency(calc.propMgmtMo)} isNegative />
              <StackRow label="Maintenance Reserve" value={formatCurrency(calc.maintenanceMo)} isNegative />
              <StackRow label="Insurance" value={formatCurrency(insuranceMo)} isNegative />
              <StackRow label="Taxes" value={formatCurrency(taxesMo)} isNegative />
              <StackRow label="Utilities" value={formatCurrency(utilitiesMo)} isNegative />
              <StackRow label="Total Expenses (Monthly)" value={formatCurrency(calc.totalExpensesMo)} isTotal isNegative />
              <StackRow label="Total Expenses (Yearly)" value={formatCurrency(calc.totalExpensesYr)} isNegative />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-primary/10 space-y-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Net Operating Income</span>
              <span>
                <span className="text-sm font-bold text-primary">{formatCurrency(calc.noiMo)}</span>
                <span className="text-xs text-muted-foreground">/mo</span>
                <span className="mx-1 text-muted-foreground">•</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(calc.noiYr)}</span>
                <span className="text-xs text-muted-foreground">/yr</span>
              </span>
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/20 space-y-0">
            <StackSectionHeader title="Returns" />
            <div className="grid grid-cols-2 gap-3 mt-2 mb-2">
              <div className={`text-center p-2 rounded-lg ${calc.dscr1st >= inputs.minDSCR ? 'bg-green-50 dark:bg-green-950/30' : calc.dscr1st >= 1.0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <div className="text-[10px] text-muted-foreground uppercase">DSCR (1st Only)</div>
                <div className={`text-lg font-bold ${calc.dscr1st >= inputs.minDSCR ? 'text-green-600' : calc.dscr1st >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatNumber(calc.dscr1st, 2)}x
                </div>
              </div>
              <div className={`text-center p-2 rounded-lg ${calc.dscrCombined >= inputs.minDSCR ? 'bg-green-50 dark:bg-green-950/30' : calc.dscrCombined >= 1.0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <div className="text-[10px] text-muted-foreground uppercase">DSCR (Combined)</div>
                <div className={`text-lg font-bold ${calc.dscrCombined >= inputs.minDSCR ? 'text-green-600' : calc.dscrCombined >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {formatNumber(calc.dscrCombined, 2)}x
                </div>
              </div>
            </div>

            <div className={`flex justify-between items-center py-2 rounded-lg px-2 ${calc.cashFlowMo >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              <span className="text-xs font-medium">Monthly Cash Flow</span>
              <span className={`text-sm font-bold ${calc.cashFlowMo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calc.cashFlowMo)}
              </span>
            </div>
            <div className={`flex justify-between items-center py-2 mt-1 rounded-lg px-2 ${calc.cashFlowYr >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              <span className="text-xs font-medium">Annual Cash Flow</span>
              <span className={`text-sm font-bold ${calc.cashFlowYr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(calc.cashFlowYr)}
              </span>
            </div>
            {units > 0 && (
              <div className="text-xs text-muted-foreground text-center pt-2">
                {formatCurrency(calc.cashFlowMo / units)}/unit/month • {formatCurrency(calc.cashFlowYr / units)}/unit/year
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CARD 4: Exit Strategy */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Exit Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {/* Collapsible assumptions */}
          <Collapsible open={exitAssumptionsOpen} onOpenChange={setExitAssumptionsOpen}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20 hover:bg-muted/30 transition-colors">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exit Assumptions</span>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', exitAssumptionsOpen && 'rotate-180')} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border rounded-b-lg border-t-0 p-3 bg-muted/10 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <StackInput label="Refi Year" value={refiYear} onChange={(v) => updateInput("stackRefiYear", v)} step={1} minWidth="100px" />
                  <StackInput label="Sale Year" value={saleYear} onChange={(v) => updateInput("stackSaleYear", v)} step={1} minWidth="100px" />
                  <StackInput label="Exit Cap Rate" value={exitCapRate} onChange={(v) => updateInput("stackExitCapRate", v)} suffix="%" step={0.25} minWidth="100px" />
                  <StackInput label="Cap Rate ↑/yr" value={capRateIncreasePerYear} onChange={(v) => updateInput("stackCapRateIncreasePerYear", v)} suffix="%" step={0.05} minWidth="100px" />
                  <StackInput label="Refi LTV" value={refiLTV} onChange={(v) => updateInput("stackRefiLTV", v)} suffix="%" step={5} minWidth="100px" />
                  <StackInput label="Refi Rate" value={refiRate} onChange={(v) => updateInput("stackRefiRate", v)} suffix="%" step={0.25} minWidth="100px" />
                  <StackInput label="Refi Amort (yrs)" value={refiAmort} onChange={(v) => updateInput("stackRefiAmort", v)} step={1} minWidth="100px" />
                  <StackInput label="Refi Costs %" value={refiCostsPct} onChange={(v) => updateInput("stackRefiCostsPct", v)} suffix="%" step={0.25} minWidth="100px" />
                  <StackInput label="Selling Costs %" value={sellingCostsPct} onChange={(v) => updateInput("stackSellingCostsPct", v)} suffix="%" step={0.5} minWidth="100px" />
                  <StackInput label="Prepay Penalty %" value={prepayPenaltyPct} onChange={(v) => updateInput("stackPrepayPenaltyPct", v)} suffix="%" step={0.5} minWidth="100px" />
                  <StackInput label="Rent Growth %" value={rentGrowthPct} onChange={(v) => updateInput("stackRentGrowthPct", v)} suffix="%" step={0.5} minWidth="100px" />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Refinance Waterfall */}
          <div className="border rounded-lg p-3 bg-muted/20 space-y-1">
            <StackSectionHeader title={`Refinance — Year ${refiYear}`} />
            <StackRow label="Projected NOI (Yr)" value={formatCurrency(calc.noiAtRefi)} />
            <StackRow label="Appraised Value" value={formatCurrency(calc.appraisedValueRefi)} />
            <StackRow label={`New Loan (${refiLTV}% LTV)`} value={formatCurrency(calc.newRefiLoan)} highlight="primary" />
            <StackRow label="1st Lien Payoff" value={formatCurrency(calc.loan1BalanceAtRefi)} isNegative />
            <StackRow label="2nd Lien Payoff (Seller)" value={formatCurrency(calc.loan2BalanceAtRefi)} isNegative />
            <StackRow label="Refi Costs" value={formatCurrency(calc.refiCosts)} isNegative />
            <StackRow label="Prepayment Penalty" value={formatCurrency(calc.prepayPenalty)} isNegative />
            <StackRow label="Net Refi Proceeds" value={formatCurrency(calc.netRefiProceeds)} isTotal highlight={calc.netRefiProceeds >= 0 ? 'green' : undefined} />
            <div className="pt-1 text-[10px] text-muted-foreground italic">
              All refi proceeds go to buyer — $0 was invested
            </div>
          </div>

          {/* Sale Waterfall */}
          <div className="border rounded-lg p-3 bg-muted/20 space-y-1">
            <StackSectionHeader title={`Sale — Year ${saleYear}`} />
            <StackRow label={`Sale Cap Rate (${exitCapRate}% + ${formatNumber(capRateIncreasePerYear * saleYear, 2)}% drift)`} value={`${formatNumber(calc.saleCapRate, 2)}%`} />
            <StackRow label="Sale Price" value={formatCurrency(calc.salePrice)} highlight="primary" />
            <StackRow label="Refi Loan Balance" value={formatCurrency(calc.refiLoanBalanceAtSale)} isNegative />
            <StackRow label="Selling Costs" value={formatCurrency(calc.sellingCosts)} isNegative />
            <StackRow label="Net Sale Proceeds" value={formatCurrency(calc.netSaleProceeds)} isTotal highlight={calc.netSaleProceeds >= 0 ? 'green' : undefined} />
          </div>

          {/* Final Summary */}
          <div className="border rounded-lg p-3 bg-primary/10 space-y-1">
            <StackSectionHeader title="Total Return Summary" />
            <StackRow label={`Cash from Operations (Yrs 1-${saleYear})`} value={formatCurrency(calc.totalCashFromOps)} />
            <StackRow label="Net Refi Proceeds" value={formatCurrency(calc.netRefiProceeds)} />
            <StackRow label="Net Sale Proceeds" value={formatCurrency(calc.netSaleProceeds)} />
            <StackRow label="Total Dollar Return" value={formatCurrency(calc.totalReturn)} isTotal highlight="green" />
            <div className="mt-2 px-2 py-1.5 rounded bg-green-50 dark:bg-green-950/30 text-center">
              <span className="text-xs font-bold text-green-600">$0 Invested → {formatCurrency(calc.totalReturn)} Total Return</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CARD 5: Deal Readiness */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Deal Readiness
            <span className={cn(
              'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
              allPass ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
            )}>
              {passingCount}/{readinessMetrics.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {allPass ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Stack Deal Ready</p>
                <p className="text-[10px] text-muted-foreground">All {readinessMetrics.length} metrics pass. This Stack structure is viable.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {readinessMetrics.map((m) => (
                <StackReadinessRow key={m.name} metric={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
