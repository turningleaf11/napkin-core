// Calculation engine (framework-agnostic, no backend/auth dependencies)
export * from "./lib/underwriting-calculations";
export * from "./lib/exit-calculations";
export * from "./lib/scenario-analysis";
export * from "./lib/stack-calculations";
export * from "./lib/export-offers";
export * from "./lib/broker-feedback";

// Shared types a shell's own persistence layer needs to match
export * from "./types";

// Core state hook -- pure local state + calculations, no persistence
export { useUnderwriting } from "./hooks/useUnderwriting";
export type { UnderwritingCalculations } from "./hooks/useUnderwriting";

// UI: the actual underwriting screens. Each takes data/callbacks as props;
// none of them fetch their own data or know which shell they're running in.
export { InputPanel } from "./components/underwriting/InputPanel";
export { DealDashboard } from "./components/underwriting/DealDashboard";
export { DealInsights } from "./components/underwriting/DealInsights";
export { ValuationInsights } from "./components/underwriting/ValuationInsights";
export { OfferBuilder } from "./components/underwriting/OfferBuilder";
export { OfferExitSection } from "./components/underwriting/OfferExitSection";
export { ScenarioReadiness } from "./components/underwriting/ScenarioReadiness";
export { SingleScenarioSolver } from "./components/underwriting/SingleScenarioSolver";
export { StackMethodPanel } from "./components/underwriting/StackMethodPanel";
export { BrokerFeedbackDialog } from "./components/underwriting/BrokerFeedbackDialog";
export { MetricCard, MetricRow } from "./components/underwriting/MetricCard";
