import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatCurrency, formatPercent } from '../../lib/underwriting-calculations';
import { OfferSolverResult, describeCriterion, formatCriterionValue } from '../../lib/scenario-analysis';
import { Calculator, ChevronDown, Settings, Target, Star } from 'lucide-react';

interface SingleScenarioSolverProps {
  result: OfferSolverResult;
  askingPrice: number;
  isPreferred?: boolean;
  onApply?: (price: number) => void;
  onEditCriteria?: () => void;
}

export function SingleScenarioSolver({
  result,
  askingPrice,
  isPreferred = false,
  onApply,
  onEditCriteria,
}: SingleScenarioSolverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const askingDiscount = askingPrice > 0 && result.maxOfferPrice > 0
    ? ((askingPrice - result.maxOfferPrice) / askingPrice) * 100
    : 0;

  const limitingLabel = result.unbounded
    ? 'None of your criteria limit the price'
    : result.limitingCriteria.map(describeCriterion).join(', ');

  const editCriteriaButton = onEditCriteria && (
    <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5" onClick={onEditCriteria}>
      <Settings className="h-2.5 w-2.5" />
      Edit Criteria
    </Button>
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors border border-border/50">
        <div className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Offer Price Solver</span>
          {isPreferred && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
              <Star className="h-2.5 w-2.5" />
              Preferred
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {result.meetsAllCriteria ? `Max: ${formatCurrency(result.maxOfferPrice)}` : 'No viable price'}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1.5 p-2 border rounded-lg bg-background space-y-1.5">
          {result.meetsAllCriteria ? (
            <div className="space-y-1.5">
              {/* Max price + discount + edit criteria inline */}
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] text-muted-foreground">Max Offer:</span>
                  <span className="text-sm font-bold">{formatCurrency(result.maxOfferPrice)}</span>
                  {askingPrice > 0 && askingDiscount > 0 && (
                    <span className="text-[10px] text-green-600">({formatPercent(askingDiscount)} below asking)</span>
                  )}
                </div>
                {editCriteriaButton}
              </div>

              {/* Limiting factor inline */}
              <div className="flex items-center gap-1.5 text-[10px]">
                <Target className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">Limiting:</span>
                <span className="font-medium">{limitingLabel}</span>
              </div>

              {/* Every criterion at the max price */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] pt-1 border-t">
                {result.checks.map((check) => (
                  <span key={check.key} className={`font-medium ${check.passes ? 'text-green-600' : 'text-destructive'}`}>
                    {check.label}: {formatCriterionValue(check, check.value)} {check.passes ? '✓' : '✗'}
                  </span>
                ))}
              </div>

              {/* Summary stats inline */}
              <div className="text-[10px] text-muted-foreground">
                {result.totalCapitalRequired > 0 && (
                  <>
                    Capital: <span className="font-medium text-foreground">{formatCurrency(result.totalCapitalRequired)}</span>
                    <span className="mx-1.5">•</span>
                  </>
                )}
                Cash Flow: <span className={`font-medium ${result.annualCashFlow >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(result.annualCashFlow)}/yr</span>
              </div>

              {/* Apply button */}
              {onApply && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-6 text-[10px]"
                  onClick={() => onApply(result.maxOfferPrice)}
                >
                  Use These Numbers
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-2 space-y-1">
              <p className="text-muted-foreground text-[10px]">No viable offer price found</p>
              <p className="text-[9px] text-muted-foreground">
                Can't meet at any price: {result.limitingCriteria.map(describeCriterion).join(', ')}
              </p>
              {editCriteriaButton}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
