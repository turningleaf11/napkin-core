import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { PropertyInputs, formatCurrency, formatPercent, OfferResult } from '../../lib/underwriting-calculations';
import { OfferExitResult, calculateOfferExitData } from '../../lib/exit-calculations';
import { ChevronDown, RefreshCcw, DollarSign, PieChart, Settings2 } from 'lucide-react';
import { useState } from 'react';

interface OfferExitSectionProps {
  offer: OfferResult;
  inputs: PropertyInputs;
  offerInterestRate: number;
  offerAmortization: number;
  updateInput: <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) => void;
}

interface InlineExitInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  step?: number;
}

function InlineExitInput({ label, value, onChange, suffix, step = 1 }: InlineExitInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground whitespace-nowrap min-w-[70px]">{label}</Label>
      <div className="relative flex-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`h-6 text-xs px-2 ${suffix ? 'pr-6' : ''}`}
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

function WaterfallRow({ 
  label, 
  value, 
  isNegative = false, 
  isTotal = false,
  isSummary = false,
  showPercent = false,
  percentValue = ''
}: { 
  label: string; 
  value: string; 
  isNegative?: boolean; 
  isTotal?: boolean;
  isSummary?: boolean;
  showPercent?: boolean;
  percentValue?: string;
}) {
  return (
    <div className={`flex justify-between items-center py-1 ${isTotal ? 'font-semibold border-t border-border/50 pt-2 mt-1' : ''} ${isSummary ? 'bg-primary/5 -mx-3 px-3 py-2 rounded' : ''}`}>
      <span className={`text-xs ${isSummary ? 'font-semibold' : 'text-muted-foreground'}`}>
        {label}
        {showPercent && percentValue && <span className="ml-1">({percentValue})</span>}
      </span>
      <span className={`text-sm font-medium ${isNegative ? 'text-red-600' : ''} ${isTotal || isSummary ? 'text-primary font-bold' : ''}`}>
        {isNegative && !value.startsWith('(') && !value.startsWith('-') ? `(${value})` : value}
      </span>
    </div>
  );
}

function WaterfallDivider() {
  return <div className="border-t border-dashed border-border/50 my-1" />;
}

export function OfferExitSection({ 
  offer, 
  inputs, 
  offerInterestRate, 
  offerAmortization,
  updateInput 
}: OfferExitSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Calculate exit data for this specific offer
  const exitData = calculateOfferExitData(offer, inputs, offerInterestRate, offerAmortization);
  
  return (
    <div className="mt-4 border-t pt-4">
      <Card className="bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            Exit Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          {/* Collapsible Refi/Sale Assumptions */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <Settings2 className="h-3 w-3" />
              <span>Exit Assumptions</span>
              <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <InlineExitInput
                    label="Refi Year"
                    value={inputs.refinanceAtYear}
                    onChange={(v) => updateInput('refinanceAtYear', v)}
                    step={1}
                  />
                  <InlineExitInput
                    label="Sale Year"
                    value={inputs.saleAtYear}
                    onChange={(v) => updateInput('saleAtYear', v)}
                    step={1}
                  />
                  <InlineExitInput
                    label="Refi LTV"
                    value={inputs.refiLTV}
                    onChange={(v) => updateInput('refiLTV', v)}
                    suffix="%"
                    step={5}
                  />
                  <InlineExitInput
                    label="Refi Rate"
                    value={inputs.refiInterestRate}
                    onChange={(v) => updateInput('refiInterestRate', v)}
                    suffix="%"
                    step={0.25}
                  />
                  <InlineExitInput
                    label="Refi Amort"
                    value={inputs.refiAmortization}
                    onChange={(v) => updateInput('refiAmortization', v)}
                    suffix="yrs"
                    step={5}
                  />
                  <InlineExitInput
                    label="Refi Costs"
                    value={inputs.refiCostsPercent}
                    onChange={(v) => updateInput('refiCostsPercent', v)}
                    suffix="%"
                    step={0.5}
                  />
                  <InlineExitInput
                    label="Exit Cap"
                    value={inputs.exitCapRate}
                    onChange={(v) => updateInput('exitCapRate', v)}
                    suffix="%"
                    step={0.25}
                  />
                  <InlineExitInput
                    label="Cap Inc/Yr"
                    value={inputs.exitCapRateIncreasePerYear ?? 0.1}
                    onChange={(v) => updateInput('exitCapRateIncreasePerYear', v)}
                    suffix="%"
                    step={0.05}
                  />
                  <InlineExitInput
                    label="Prepay Pen."
                    value={inputs.prepaymentPenaltyPercent}
                    onChange={(v) => updateInput('prepaymentPenaltyPercent', v)}
                    suffix="%"
                    step={0.5}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Refinance Waterfall */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider pb-2 mb-2 border-b border-border/30">
              <RefreshCcw className="h-3 w-3" />
              {exitData.hasRefi ? `Refinance (Year ${exitData.refiYear})` : 'Refinance'}
            </div>
            {!exitData.hasRefi ? (
              <p className="text-xs text-muted-foreground">
                No refinance planned — set a refi year between 1 and the sale year to include one.
              </p>
            ) : (
            <div className="space-y-0">
              <WaterfallRow label="Net Operating Income" value={formatCurrency(exitData.refiNOI)} />
              <WaterfallRow label="Cap Rate at Refinance" value={formatPercent(exitData.refiCapRate)} />
              <WaterfallRow label="Appraised Value" value={formatCurrency(exitData.refiAppraisedValue)} />
              <WaterfallDivider />
              <WaterfallRow 
                label={`New Loan (${inputs.refiLTV}% LTV)`} 
                value={formatCurrency(exitData.refiNewLoanAmount)} 
              />
              <WaterfallRow 
                label={`Refinance Costs (${inputs.refiCostsPercent}%)`} 
                value={formatCurrency(exitData.refiCosts)} 
                isNegative 
              />
              {exitData.prepaymentPenalty > 0 && (
                <WaterfallRow label="Prepayment Penalty" value={formatCurrency(exitData.prepaymentPenalty)} isNegative />
              )}
              <WaterfallRow 
                label="Repay Outstanding Balance" 
                value={formatCurrency(exitData.outstandingBalanceAtRefi)} 
                isNegative 
              />
              <WaterfallDivider />
              <WaterfallRow label="Gross Proceeds" value={formatCurrency(exitData.grossRefiProceeds)} isTotal />
              <WaterfallRow 
                label="- Return of Member Capital" 
                value={formatCurrency(exitData.returnOfCapitalAtRefi)} 
              />
              <WaterfallDivider />
              <WaterfallRow 
                label="Capital Account After Refi" 
                value={formatCurrency(exitData.capitalAccountAfterRefi)} 
              />
              <WaterfallRow 
                label="% of Initial Invested Returned" 
                value={formatPercent(exitData.pctInvestmentReturnedAtRefi)} 
              />
              <WaterfallDivider />
              <WaterfallRow label="Principal Reduction" value={formatCurrency(exitData.principalReductionAtRefi)} />
              <WaterfallRow label="Appreciation" value={formatCurrency(exitData.appreciationAtRefi)} />
              {exitData.capitalTransactionFeeRefi > 0 && (
                <WaterfallRow 
                  label={`Capital Transaction Fee (${inputs.capitalTransactionFeePercent}%)`} 
                  value={formatCurrency(exitData.capitalTransactionFeeRefi)} 
                />
              )}
              {exitData.memberProfitRefi > 0 && (
                <>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      Net to Members (
                      <Input
                        type="number"
                        value={inputs.memberProfitSharePercent}
                        onChange={(e) => updateInput('memberProfitSharePercent', parseFloat(e.target.value) || 0)}
                        className="h-5 w-12 text-xs px-1 text-center inline-block"
                        min={0}
                        max={100}
                        step={5}
                      />
                      %)
                    </span>
                    <span className="text-sm font-medium">{formatCurrency(exitData.memberProfitRefi)}</span>
                  </div>
                  <WaterfallRow 
                    label={`Net to Manager (${100 - inputs.memberProfitSharePercent}%)`} 
                    value={formatCurrency(exitData.managerProfitRefi)} 
                  />
                </>
              )}
              <WaterfallRow 
                label="Total Cash to Members at Refi" 
                value={formatCurrency(exitData.totalCashToMembersAtRefi)} 
                isSummary
              />
            </div>
            )}
          </div>

          {/* Sale Waterfall */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider pb-2 mb-2 border-b border-border/30">
              <DollarSign className="h-3 w-3" />
              Sale (Year {exitData.saleYear})
            </div>
            {!exitData.saleCountedInReturns && (
              <p className="text-xs text-muted-foreground pb-2">
                The sale is in the same year as the refinance, so returns are measured through the refinance, as in
                the spreadsheet. Set a later sale year to count it.
              </p>
            )}
            <div className={`space-y-0 ${exitData.saleCountedInReturns ? '' : 'opacity-50'}`}>
              <WaterfallRow label="Net Operating Income" value={formatCurrency(exitData.saleNOI)} />
              <WaterfallRow label="Cap Rate" value={formatPercent(exitData.saleCapRate, 2)} />
              <WaterfallRow label="Sales Price" value={formatCurrency(exitData.salePrice)} />
              <WaterfallRow 
                label={`Operating Reserves Returned (${inputs.reservesReturnedPercent}%)`} 
                value={formatCurrency(exitData.reservesReturned)} 
              />
              <WaterfallDivider />
              <WaterfallRow 
                label={`Selling Costs (${inputs.sellingCostsPercent}%)`} 
                value={formatCurrency(exitData.sellingCosts)} 
                isNegative 
              />
              <WaterfallRow 
                label="Outstanding Loan Balance" 
                value={formatCurrency(exitData.outstandingBalanceAtSale)} 
                isNegative 
              />
              <WaterfallDivider />
              <WaterfallRow label="Total Equity" value={formatCurrency(exitData.totalEquity)} isTotal />
              <WaterfallRow 
                label="- Return of Member Capital" 
                value={formatCurrency(exitData.returnOfCapitalAtSale)} 
              />
              <WaterfallDivider />
              <WaterfallRow label="Net Proceeds/Profit" value={formatCurrency(exitData.netProfitFromSale)} />
              <WaterfallDivider />
              <WaterfallRow label="Principal Reduction" value={formatCurrency(exitData.principalReductionAtSale)} />
              <WaterfallRow label="Appreciation" value={formatCurrency(exitData.appreciationAtSale)} />
              <WaterfallRow 
                label={`Capital Transaction Fee (${inputs.capitalTransactionFeePercent}%)`} 
                value={formatCurrency(exitData.capitalTransactionFeeSale)} 
              />
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  Net to Members (
                  <Input
                    type="number"
                    value={inputs.memberProfitSharePercent}
                    onChange={(e) => updateInput('memberProfitSharePercent', parseFloat(e.target.value) || 0)}
                    className="h-5 w-12 text-xs px-1 text-center inline-block"
                    min={0}
                    max={100}
                    step={5}
                  />
                  %)
                </span>
                <span className="text-sm font-medium">{formatCurrency(exitData.memberProfitSale)}</span>
              </div>
              <WaterfallRow 
                label={`Net to Manager (${100 - inputs.memberProfitSharePercent}%)`} 
                value={formatCurrency(exitData.managerProfitSale)} 
              />
              <WaterfallRow 
                label="Total Cash to Members at Sale" 
                value={formatCurrency(exitData.totalCashToMembersAtSale)} 
                isSummary
              />
            </div>
          </div>

        {/* Final Summary */}
        <div className="border rounded-lg p-3 bg-primary/10">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider pb-2 mb-2 border-b border-primary/20">
            After Final Disposition
          </div>
          <div className="space-y-2">
            <WaterfallRow 
              label="Total Profits from Appreciation" 
              value={formatCurrency(exitData.totalProfitsFromAppreciation)} 
            />
            <WaterfallRow 
              label="Total Return on Investment (Members)" 
              value={formatCurrency(exitData.totalCashToMembers)} 
              isSummary
            />
            <WaterfallRow 
              label="Total Cash Paid to Members (incl. capital)" 
              value={formatCurrency(exitData.totalCashPaidToMembers)} 
            />
            <WaterfallRow 
              label="Total ROI" 
              value={formatPercent(exitData.totalROI)} 
            />
            <WaterfallRow 
              label="IRR" 
              value={formatPercent(exitData.irr)} 
            />
            <WaterfallRow 
              label="AAR" 
              value={formatPercent(exitData.aar)} 
            />
            <WaterfallRow 
              label="Avg COC" 
              value={formatPercent(exitData.avgCashOnCash)} 
            />
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}