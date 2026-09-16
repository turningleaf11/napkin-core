import { useState } from 'react';
import { DealInsight } from '../../lib/underwriting-calculations';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronDown, Lightbulb, Target, Search, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DealInsightsProps {
  insights: DealInsight[];
}

function InsightCard({ insight }: { insight: DealInsight }) {
  const [isOpen, setIsOpen] = useState(false);

  const severityConfig = {
    error: {
      icon: AlertCircle,
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      iconColor: 'text-destructive',
      headerBg: 'bg-destructive/5',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-600',
      headerBg: 'bg-amber-500/5',
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-600',
      headerBg: 'bg-blue-500/5',
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-600',
      headerBg: 'bg-green-500/5',
    },
  };

  const config = severityConfig[insight.severity];
  const Icon = config.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border', config.borderColor, config.bgColor)}>
        <CollapsibleTrigger className="w-full">
          <div className={cn('flex items-start gap-3 p-3 rounded-t-lg', config.headerBg)}>
            <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.iconColor)} />
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">{insight.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{insight.summary}</div>
            </div>
            <ChevronDown 
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )} 
            />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 text-sm">
            {/* Why it matters */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 font-medium text-xs text-muted-foreground mb-1.5">
                <Lightbulb className="h-3.5 w-3.5" />
                Why it matters
              </div>
              <p className="text-foreground/80 leading-relaxed">
                {insight.whyItMatters}
              </p>
            </div>

            {/* Look for in OM */}
            <div>
              <div className="flex items-center gap-2 font-medium text-xs text-muted-foreground mb-1.5">
                <Search className="h-3.5 w-3.5" />
                Look for in the OM
              </div>
              <ul className="space-y-1">
                {insight.lookForInOM.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-foreground/80">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What to adjust */}
            <div>
              <div className="flex items-center gap-2 font-medium text-xs text-muted-foreground mb-1.5">
                <Wrench className="h-3.5 w-3.5" />
                What to adjust
              </div>
              <ul className="space-y-1">
                {insight.whatToAdjust.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-foreground/80">
                    <Target className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function DealInsights({ insights }: DealInsightsProps) {
  if (insights.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm">This deal passes all quick checks at asking price!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errorCount = insights.filter(i => i.severity === 'error').length;
  const warningCount = insights.filter(i => i.severity === 'warning').length;

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Deal Insights
          </div>
          <div className="flex items-center gap-2 text-xs font-normal">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {warningCount}
              </span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </CardContent>
    </Card>
  );
}
