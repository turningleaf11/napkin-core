import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '../../hooks/use-toast';
import { Copy, RefreshCw, MessageSquareText, Loader2 } from 'lucide-react';
import { PropertyInputs } from '../../lib/underwriting-calculations';
import { UnderwritingCalculations } from '../../hooks/useUnderwriting';
import { prepareBrokerFeedbackPayload, streamBrokerFeedback } from '../../lib/broker-feedback';

interface BrokerFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputs: PropertyInputs;
  calculations: UnderwritingCalculations;
  scenarioType: 'dscr' | 'seller';
  dealId: string | null;
  savedFeedback: string | null;
  onSaveFeedback: (scenarioType: 'dscr' | 'seller', text: string) => Promise<void>;
  // The shell's own broker-feedback endpoint + auth -- see streamBrokerFeedback.
  endpointUrl: string;
  getAuthToken: () => Promise<string | null | undefined>;
}

export function BrokerFeedbackDialog({
  open,
  onOpenChange,
  inputs,
  calculations,
  scenarioType,
  dealId,
  savedFeedback,
  onSaveFeedback,
  endpointUrl,
  getAuthToken,
}: BrokerFeedbackDialogProps) {
  const [feedback, setFeedback] = useState(savedFeedback || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(!!savedFeedback);
  const { toast } = useToast();

  // Sync when savedFeedback or scenarioType changes
  useEffect(() => {
    setFeedback(savedFeedback || '');
    setHasGenerated(!!savedFeedback);
  }, [savedFeedback, scenarioType]);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setFeedback('');
    setHasGenerated(true);

    const dealMetrics = prepareBrokerFeedbackPayload(inputs, calculations, scenarioType);

    let accumulated = '';
    await streamBrokerFeedback({
      endpointUrl,
      getAuthToken,
      dealMetrics,
      onDelta: (chunk) => {
        accumulated += chunk;
        setFeedback(accumulated);
      },
      onDone: () => {
        setIsGenerating(false);
        // Auto-save feedback to deal if we have a dealId
        if (dealId) {
          onSaveFeedback(scenarioType, accumulated);
        }
      },
      onError: (error) => {
        setIsGenerating(false);
        toast({
          title: 'Generation failed',
          description: error,
          variant: 'destructive',
        });
      },
    });
  }, [inputs, calculations, scenarioType, toast, dealId, onSaveFeedback, endpointUrl, getAuthToken]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(feedback);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  }, [feedback, toast]);

  const scenarioLabel = scenarioType === 'dscr' ? 'DSCR Loan' : 'Seller Finance';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Broker Feedback
          </DialogTitle>
          <DialogDescription>
            AI-generated talking points for the {scenarioLabel} scenario
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {!hasGenerated ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Generate professional broker feedback based on your {scenarioLabel} analysis.
                The AI will craft talking points tailored to this deal's metrics.
              </p>
              <Button onClick={generate} className="gap-2">
                <MessageSquareText className="h-4 w-4" />
                Generate Feedback
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {isGenerating && !feedback && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analyzing deal metrics...</span>
                </div>
              )}
              {feedback && (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {feedback}
                  {isGenerating && (
                    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
                  )}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {hasGenerated && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={isGenerating}
              className="gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
            <Button
              size="sm"
              onClick={copyToClipboard}
              disabled={isGenerating || !feedback}
              className="gap-1"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
