import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import {
  PropertyInputs,
  OfferResult,
  DealReadinessMetric,
  formatPercent,
  formatNumber,
  formatCurrency,
} from '../../lib/underwriting-calculations';
import { getScenarioReadiness } from '../../lib/scenario-analysis';
import { CheckCircle2, XCircle, ChevronDown, Lightbulb, Search, Wrench, Target, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScenarioReadinessProps {
  inputs: PropertyInputs;
  offer: OfferResult;
  offerPrice: number;
  scenario: 'dscr' | 'seller';
}

function ReadinessInsightRow({ metric, forceOpen }: { metric: DealReadinessMetric; forceOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = forceOpen ?? isOpen;

  return (
    <Collapsible open={open} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          'flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-muted/50 transition-colors',
          open && 'bg-rose-500/5'
        )}>
          <XCircle className="h-3 w-3 text-rose-500 flex-shrink-0" />
          <span className="text-[10px] font-medium text-left flex-1 truncate">
            {metric.name} Below Threshold
          </span>
          <ChevronDown className={cn('h-2.5 w-2.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
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
            <ul className="space-y-0">
              {metric.lookForInOM.map((item, i) => (
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
              {metric.whatToAdjust.map((item, i) => (
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

function ExpandableReadinessList({ failingMetrics }: { failingMetrics: DealReadinessMetric[] }) {
  const [allExpanded, setAllExpanded] = useState(false);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <XCircle className="h-3 w-3 text-rose-500" />
          <span>{failingMetrics.length} Issue{failingMetrics.length > 1 ? 's' : ''} to Review</span>
        </div>
        <button
          onClick={() => setAllExpanded(!allExpanded)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronsUpDown className="h-3 w-3" />
          {allExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className="space-y-0">
        {failingMetrics.map((metric) => (
          <ReadinessInsightRow key={metric.name} metric={metric} forceOpen={allExpanded ? true : undefined} />
        ))}
      </div>
    </div>
  );
}

export function ScenarioReadiness({ inputs, offer, offerPrice, scenario }: ScenarioReadinessProps) {
  const readiness = getScenarioReadiness(inputs, offer, offerPrice, scenario);
  const passCount = readiness.filter((m) => m.passes).length;
  const totalCount = readiness.length;
  const overallPass = passCount === totalCount;
  const failingMetrics = readiness.filter((m) => !m.passes);

  const formatValue = (metric: DealReadinessMetric) => {
    if (metric.unit === '%') return formatPercent(metric.value);
    if (metric.unit === 'x') return formatNumber(metric.value, 2) + 'x';
    if (metric.unit === '$') return formatCurrency(metric.value);
    if (metric.unit === '$/mo') return formatCurrency(metric.value);
    return formatNumber(metric.value, 2) + metric.unit;
  };

  return (
    <Card className={overallPass ? 'border-green-500/50 bg-green-50/30 dark:bg-green-950/20' : 'border-rose-500/50 bg-rose-50/30 dark:bg-rose-950/20'}>
      <CardHeader className="py-3 px-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {overallPass ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-500" />
            )}
            Deal Readiness
          </CardTitle>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-bold ${overallPass ? 'text-green-600' : 'text-rose-500'}`}>
              {passCount}/{totalCount}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Two-column grid of metric badges */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {readiness.map((metric) => (
            <div key={metric.name} className="flex justify-between items-center text-xs py-0.5">
              <span className="text-muted-foreground truncate">{metric.name}</span>
              <span className={`font-medium ${metric.passes ? 'text-green-600' : 'text-rose-500'}`}>
                {formatValue(metric)} {metric.passes ? '✓' : '✗'}
              </span>
            </div>
          ))}
        </div>
        
        {/* Failing metrics with expandable insights */}
        {failingMetrics.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <ExpandableReadinessList failingMetrics={failingMetrics} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
