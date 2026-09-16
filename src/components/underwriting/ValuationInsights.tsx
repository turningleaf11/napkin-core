import { DealInsight, formatCurrency, formatPercent, formatNumber } from '../../lib/underwriting-calculations';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { AlertCircle, AlertTriangle, CheckCircle, TrendingUp, ChevronDown, Lightbulb, Target, Search, Wrench, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useState } from 'react';

interface ValuationInsightsProps {
  fairMarketValue: number;
  askingPrice: number;
  noi: number;
  grossMonthlyRents: number;
  marketCapRate: number;
  insights: DealInsight[];
}

// Inline metric with status indicator
function InlineMetric({ label, value, status }: { 
  label: string; 
  value: string; 
  status: 'pass' | 'warning' | 'fail' | 'neutral';
}) {
  const statusColors = {
    pass: 'text-green-600',
    warning: 'text-amber-600',
    fail: 'text-destructive',
    neutral: 'text-foreground',
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn('font-semibold', statusColors[status])}>{value}</span>
    </div>
  );
}

function InsightRow({ insight, forceOpen }: { insight: DealInsight; forceOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = forceOpen ?? isOpen;

  const severityConfig = {
    error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/5' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-500/5' },
    info: { icon: Lightbulb, color: 'text-blue-600', bg: 'bg-blue-500/5' },
    success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-500/5' },
  };

  const config = severityConfig[insight.severity];
  const Icon = config.icon;

  return (
    <Collapsible open={open} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn('flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-muted/50 transition-colors', open && config.bg)}>
          <Icon className={cn('h-3 w-3 flex-shrink-0', config.color)} />
          <span className="text-[10px] font-medium text-left flex-1 truncate">{insight.title}</span>
          <ChevronDown className={cn('h-2.5 w-2.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-5 pr-1.5 pb-1.5 space-y-1.5 text-[10px]">
          <p className="text-muted-foreground">{insight.summary}</p>
          
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 font-medium text-muted-foreground">
              <Lightbulb className="h-2.5 w-2.5" />
              Why it matters
            </div>
            <p className="text-foreground/80">{insight.whyItMatters}</p>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 font-medium text-muted-foreground">
              <Search className="h-2.5 w-2.5" />
              Look for in OM
            </div>
            <ul className="space-y-0">
              {insight.lookForInOM.map((item, i) => (
                <li key={i} className="text-foreground/80">• {item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 font-medium text-muted-foreground">
              <Wrench className="h-2.5 w-2.5" />
              What to adjust
            </div>
            <ul className="space-y-0">
              {insight.whatToAdjust.map((item, i) => (
                <li key={i} className="flex items-start gap-1 text-foreground/80">
                  <Target className="h-2.5 w-2.5 text-primary mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExpandableIssuesList({ insights, errorCount, warningCount }: { insights: DealInsight[]; errorCount: number; warningCount: number }) {
  const [allExpanded, setAllExpanded] = useState(false);

  return (
    <div className="space-y-0.5">
      {/* Issue count header with expand all toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {errorCount > 0 && (
            <span className="flex items-center gap-0.5 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              {warningCount}
            </span>
          )}
          <span>Issues to Review</span>
        </div>
        <button
          onClick={() => setAllExpanded(!allExpanded)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronsUpDown className="h-3 w-3" />
          {allExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {/* Insight grid - 2 columns on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2">
        {insights.map((insight) => (
          <InsightRow key={insight.id} insight={insight} forceOpen={allExpanded ? true : undefined} />
        ))}
      </div>
    </div>
  );
}

export function ValuationInsights({
  fairMarketValue,
  askingPrice,
  noi,
  grossMonthlyRents,
  marketCapRate,
  insights,
}: ValuationInsightsProps) {
  // Calculate metrics
  const onePercentRatio = askingPrice > 0 ? (grossMonthlyRents / askingPrice) : 0;
  const passes1PercentRule = onePercentRatio >= 0.01;
  const grm = askingPrice > 0 ? askingPrice / (grossMonthlyRents * 12) : 0;
  const capRateAtAsk = askingPrice > 0 ? (noi / askingPrice) * 100 : 0;
  const fmvGap = fairMarketValue - askingPrice;

  // Status helpers
  const get1PercentStatus = () => passes1PercentRule ? 'pass' : 'fail';
  const getGrmStatus = () => grm < 10 ? 'pass' : grm < 12 ? 'warning' : 'fail';
  const getCapStatus = () => capRateAtAsk >= marketCapRate ? 'pass' : 'warning';
  const getFmvStatus = () => fmvGap >= 0 ? 'pass' : 'fail';

  const errorCount = insights.filter(i => i.severity === 'error').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;

  return (
    <Card>
      <CardHeader className="py-1.5 px-3">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          Valuation & Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2 space-y-2">
        {/* Metrics Row - All inline */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <InlineMetric 
            label="FMV" 
            value={formatCurrency(fairMarketValue)} 
            status={askingPrice > 0 ? getFmvStatus() : 'neutral'} 
          />
          <InlineMetric 
            label="1%" 
            value={passes1PercentRule ? 'PASS' : 'FAIL'} 
            status={askingPrice > 0 ? get1PercentStatus() : 'neutral'} 
          />
          <InlineMetric 
            label="GRM" 
            value={askingPrice > 0 ? formatNumber(grm, 1) : 'N/A'} 
            status={askingPrice > 0 ? getGrmStatus() : 'neutral'} 
          />
          <InlineMetric 
            label="Cap" 
            value={askingPrice > 0 ? formatPercent(capRateAtAsk) : 'N/A'} 
            status={askingPrice > 0 ? getCapStatus() : 'neutral'} 
          />
          <InlineMetric 
            label="NOI" 
            value={formatCurrency(noi)} 
            status="pass" 
          />
          <InlineMetric 
            label="MCR" 
            value={formatPercent(marketCapRate)} 
            status="neutral" 
          />
        </div>

        {/* Divider */}
        {insights.length > 0 && <div className="h-px bg-border" />}

        {/* Deal Insights */}
        {insights.length === 0 ? (
          <div className="flex items-center gap-1.5 text-green-600 text-xs">
            <CheckCircle className="h-3.5 w-3.5" />
            All checks pass!
          </div>
        ) : (
          <ExpandableIssuesList
            insights={insights}
            errorCount={errorCount}
            warningCount={warningCount}
          />
        )}
      </CardContent>
    </Card>
  );
}
