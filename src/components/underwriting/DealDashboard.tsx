import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { BrokerFeedbackData } from '../../types';
import { UnderwritingCalculations } from '../../hooks/useUnderwriting';
import { PropertyInputs, formatCurrency, formatPercent, formatNumber, getDealInsights } from '../../lib/underwriting-calculations';
import { MetricRow } from './MetricCard';
import { OfferBuilder } from './OfferBuilder';
import { ValuationInsights } from './ValuationInsights';
import { Building2, Calculator, BarChart3 } from 'lucide-react';

interface DealDashboardProps {
  inputs: PropertyInputs;
  calculations: UnderwritingCalculations;
  updateInput: <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) => void;
  dealId: string | null;
  brokerFeedback: BrokerFeedbackData | null;
  onSaveBrokerFeedback: (dealId: string, scenarioType: 'dscr' | 'seller', text: string) => Promise<boolean>;
  onEditCriteria?: () => void;
  brokerFeedbackEndpointUrl: string;
  getAuthToken: () => Promise<string | null | undefined>;
}

export function DealDashboard({ inputs, calculations, updateInput, dealId, brokerFeedback, onSaveBrokerFeedback, onEditCriteria, brokerFeedbackEndpointUrl, getAuthToken }: DealDashboardProps) {
  const [perUnitView, setPerUnitView] = useState<'monthly' | 'annually'>('monthly');
  const [activeSubTab, setActiveSubTab] = useState('dscr');
  
  const {
    noi,
    fairMarketValue,
    capRate,
    grm,
    passes1PercentRule,
    dscr,
    cashFlow,
    totalCapitalRequired,
    cashOnCash,
    pricePerUnit,
    rentPerUnit,
    noiPerUnit,
    debtServicePerUnit,
    cashFlowPerUnit,
    annualDebtService,
    effectiveGrossIncome,
    operatingExpenses,
    // Overview-specific (asking price based)
    overviewAnnualDebtService,
    overviewTotalCapitalRequired,
    overviewCashFlow,
    overviewPricePerUnit,
  } = calculations;

  const insights = getDealInsights(inputs);

  // Per unit values based on view mode
  const getPerUnitValue = (annualValue: number) => 
    perUnitView === 'monthly' ? annualValue / 12 : annualValue;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <Tabs defaultValue="overview" className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 pt-4 pb-2 border-b">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="overview" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              Napkin
            </TabsTrigger>
            <TabsTrigger value="offers" className="text-xs gap-1">
              <Calculator className="h-3 w-3" />
              Our Numbers
            </TabsTrigger>
          </TabsList>
        </div>

        <div className={`flex-1 p-4 space-y-4 mx-auto ${activeSubTab === 'stack' ? 'max-w-4xl' : 'max-w-2xl'}`}>
          {/* Overview Tab */}
          <TabsContent value="overview" className="m-0 space-y-4">
            {/* Combined Valuation & Insights */}
            <ValuationInsights
              fairMarketValue={fairMarketValue}
              askingPrice={inputs.askingPrice}
              noi={noi}
              grossMonthlyRents={inputs.grossMonthlyRents}
              marketCapRate={inputs.marketCapRate}
              insights={insights}
            />

            {/* Income Summary */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">Income & Expenses</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-0">
                  <MetricRow label="Gross Annual Income" value={formatCurrency(inputs.grossMonthlyRents * 12)} />
                  <MetricRow label="Effective Gross Income" value={formatCurrency(effectiveGrossIncome)} />
                  <MetricRow label="Operating Expenses" value={`(${formatCurrency(operatingExpenses)})`} />
                </div>
              </CardContent>
            </Card>

            {/* Separate NOI Display */}
            <div className="flex justify-between items-center py-3 px-4 bg-primary/10 rounded-lg">
              <span className="text-sm font-semibold">Net Operating Income</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(noi)}</span>
            </div>

            {/* Financing Summary */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium">Financing Summary</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {/* Inline editable loan parameters */}
                <div className="flex flex-wrap items-center gap-3 pb-3 mb-3 border-b text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">LTV</span>
                    <Input 
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      value={inputs.ltv} 
                      onChange={(e) => updateInput('ltv', Number(e.target.value))} 
                      className="h-6 w-12 text-xs px-1 text-center" 
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Rate</span>
                    <Input 
                      type="number"
                      step="0.1"
                      value={inputs.interestRate} 
                      onChange={(e) => updateInput('interestRate', Number(e.target.value))} 
                      className="h-6 w-12 text-xs px-1 text-center" 
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Amort</span>
                    <Input 
                      type="number"
                      value={inputs.amortizationYears} 
                      onChange={(e) => updateInput('amortizationYears', Number(e.target.value))} 
                      className="h-6 w-12 text-xs px-1 text-center" 
                    />
                    <span className="text-muted-foreground">yr</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">IO</span>
                    <Input 
                      type="number"
                      value={inputs.interestOnlyMonths} 
                      onChange={(e) => updateInput('interestOnlyMonths', Number(e.target.value))} 
                      className="h-6 w-12 text-xs px-1 text-center" 
                    />
                    <span className="text-muted-foreground">mo</span>
                  </div>
                </div>
                <div className="space-y-0">
                  <MetricRow label="Purchase Price" value={formatCurrency(inputs.askingPrice)} />
                  <MetricRow label="Loan Amount" value={formatCurrency(inputs.askingPrice * (inputs.ltv / 100))} />
                  <MetricRow label="Down Payment" value={formatCurrency(inputs.askingPrice * (1 - inputs.ltv / 100))} />
                  <MetricRow label="Annual Debt Service" value={formatCurrency(overviewAnnualDebtService)} />
                  <MetricRow label="Total Capital Required" value={formatCurrency(overviewTotalCapitalRequired)} />
                  <div className="flex justify-between items-center py-2 bg-muted/50 -mx-4 px-4 mt-1">
                    <span className="text-sm font-semibold">Annual Cash Flow</span>
                    <span className={`text-lg font-bold ${overviewCashFlow >= 0 ? 'text-green-600' : 'text-rose-500'}`}>
                      {formatCurrency(overviewCashFlow)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Per Unit Analysis */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Per Unit Analysis ({inputs.units} units)
                  </CardTitle>
                  <div className="flex h-6 rounded-md border border-input bg-background text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPerUnitView('monthly')}
                      className={`px-2 rounded-l-md transition-colors ${
                        perUnitView === 'monthly' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setPerUnitView('annually')}
                      className={`px-2 rounded-r-md transition-colors ${
                        perUnitView === 'annually' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      Annually
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-muted-foreground font-medium">Metric</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Per Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Price Per Unit</td>
                        <td className="text-right font-medium">{formatCurrency(overviewPricePerUnit)}</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Gross Rent</td>
                        <td className="text-right font-medium">
                          {formatCurrency(perUnitView === 'monthly' ? rentPerUnit : rentPerUnit * 12)}
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">NOI</td>
                        <td className="text-right font-medium">
                          {formatCurrency(getPerUnitValue(noiPerUnit))}
                        </td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">Debt Service</td>
                        <td className="text-right font-medium">
                          {formatCurrency(getPerUnitValue(debtServicePerUnit))}
                        </td>
                      </tr>
                      <tr className="bg-primary/10 font-semibold">
                        <td className="py-2 rounded-l">Cash Flow Per Door</td>
                        <td className="text-right text-primary rounded-r">
                          {formatCurrency(getPerUnitValue(cashFlowPerUnit))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Offers Tab */}
          <TabsContent value="offers" className="m-0">
            <OfferBuilder inputs={inputs} calculations={calculations} updateInput={updateInput} dealId={dealId} brokerFeedback={brokerFeedback} onSaveBrokerFeedback={onSaveBrokerFeedback} onSubTabChange={setActiveSubTab} onEditCriteria={onEditCriteria} brokerFeedbackEndpointUrl={brokerFeedbackEndpointUrl} getAuthToken={getAuthToken} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
