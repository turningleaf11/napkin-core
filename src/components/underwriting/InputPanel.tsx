import React from 'react';
import { PropertyInputs } from '../../lib/underwriting-calculations';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Building2, Percent, Wrench, TrendingUp } from 'lucide-react';
import { Toggle } from '../ui/toggle';

interface InputPanelProps {
  inputs: PropertyInputs;
  updateInput: <K extends keyof PropertyInputs>(key: K, value: PropertyInputs[K]) => void;
}

interface InputFieldProps {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  type?: 'number' | 'text';
  step?: number;
}

function InputField({ label, value, onChange, prefix, suffix, step = 1 }: InputFieldProps) {
  const [displayValue, setDisplayValue] = React.useState(String(value));
  
  React.useEffect(() => {
    setDisplayValue(String(value));
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    
    const parsed = parseFloat(newValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (newValue === '' || newValue === '-') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(displayValue);
    if (isNaN(parsed) || displayValue === '') {
      setDisplayValue('0');
      onChange(0);
    } else {
      setDisplayValue(String(parsed));
    }
  };

  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={`h-7 text-xs ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-7' : ''}`}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  isLast?: boolean;
}

function Section({ icon, title, children, isLast = false }: SectionProps) {
  return (
    <div className={`pb-3 ${!isLast ? 'border-b border-border/50' : ''}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-medium text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

// Text input field for property name/address
function TextInputField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-xs"
      />
    </div>
  );
}

export function InputPanel({ inputs, updateInput }: InputPanelProps) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-3 space-y-3">
      {/* Flat Sections */}
      <div className="space-y-3">
        {/* Property Basics */}
        <Section
          icon={<Building2 className="h-3.5 w-3.5 text-primary" />}
          title="Property Basics"
        >
          <div className="grid gap-2">
            <TextInputField
              label="Property Name"
              value={inputs.propertyName}
              onChange={(v) => updateInput('propertyName', v)}
              placeholder="Enter property name..."
            />
            <TextInputField
              label="Property Address"
              value={inputs.propertyAddress || ''}
              onChange={(v) => updateInput('propertyAddress', v)}
              placeholder="Enter property address..."
            />
            <div className="grid grid-cols-2 gap-2">
              <InputField
                label="Asking Price"
                value={inputs.askingPrice}
                onChange={(v) => updateInput('askingPrice', v)}
                prefix="$"
              />
              <InputField
                label="Units"
                value={inputs.units}
                onChange={(v) => updateInput('units', v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InputField
                label="Gross Monthly Rents"
                value={inputs.grossMonthlyRents}
                onChange={(v) => updateInput('grossMonthlyRents', v)}
                prefix="$"
              />
              <InputField
                label="Other Income (Annual)"
                value={inputs.otherIncome}
                onChange={(v) => updateInput('otherIncome', v)}
                prefix="$"
              />
            </div>
          </div>
        </Section>

        {/* Assumptions */}
        <Section
          icon={<Percent className="h-3.5 w-3.5 text-primary" />}
          title="Assumptions"
        >
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="Vacancy"
              value={inputs.vacancyRate}
              onChange={(v) => updateInput('vacancyRate', v)}
              suffix="%"
              step={0.5}
            />
            {/* Expense with toggle */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground">Expenses</Label>
                <div className="flex h-5 rounded-md border border-input bg-background text-[9px]">
                  <button
                    type="button"
                    onClick={() => updateInput('expenseMode', 'percent')}
                    className={`px-1.5 rounded-l-md transition-colors ${
                      inputs.expenseMode === 'percent' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => updateInput('expenseMode', 'dollar')}
                    className={`px-1.5 rounded-r-md transition-colors ${
                      inputs.expenseMode === 'dollar' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    $
                  </button>
                </div>
              </div>
              {inputs.expenseMode === 'percent' ? (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={inputs.expenseRate}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      if (!isNaN(parsed)) updateInput('expenseRate', parsed);
                      else if (e.target.value === '') updateInput('expenseRate', 0);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="h-7 text-xs pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={inputs.expenseAmount}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      if (!isNaN(parsed)) updateInput('expenseAmount', parsed);
                      else if (e.target.value === '') updateInput('expenseAmount', 0);
                    }}
                    onFocus={(e) => e.target.select()}
                    className="h-7 text-xs pl-5"
                  />
                </div>
              )}
            </div>
            <InputField
              label="Market Cap Rate"
              value={inputs.marketCapRate}
              onChange={(v) => updateInput('marketCapRate', v)}
              suffix="%"
              step={0.25}
            />
            <InputField
              label="Concessions/LTL"
              value={inputs.concessionsRate}
              onChange={(v) => updateInput('concessionsRate', v)}
              suffix="%"
              step={0.5}
            />
          </div>
        </Section>

        {/* Costs */}
        <Section
          icon={<Wrench className="h-3.5 w-3.5 text-primary" />}
          title="Costs"
        >
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="Repairs"
              value={inputs.repairs}
              onChange={(v) => updateInput('repairs', v)}
              prefix="$"
            />
            <InputField
              label="Operating Reserves"
              value={inputs.operatingReserves}
              onChange={(v) => updateInput('operatingReserves', v)}
              prefix="$"
            />
            <InputField
              label="Closing Costs"
              value={inputs.closingCostsPercent}
              onChange={(v) => updateInput('closingCostsPercent', v)}
              suffix="%"
              step={0.5}
            />
          </div>
        </Section>

        {/* Exit Assumptions */}
        <Section
          icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
          title="Exit Assumptions"
          isLast
        >
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="Annual Rent Growth"
              value={inputs.annualRentGrowth}
              onChange={(v) => updateInput('annualRentGrowth', v)}
              suffix="%"
              step={0.5}
            />
            <InputField
              label="Annual Expense Growth"
              value={inputs.annualExpenseGrowth}
              onChange={(v) => updateInput('annualExpenseGrowth', v)}
              suffix="%"
              step={0.5}
            />
            <InputField
              label="Exit Cap Rate"
              value={inputs.exitCapRate}
              onChange={(v) => updateInput('exitCapRate', v)}
              suffix="%"
              step={0.25}
            />
            <InputField
              label="Selling Costs"
              value={inputs.sellingCostsPercent}
              onChange={(v) => updateInput('sellingCostsPercent', v)}
              suffix="%"
              step={0.5}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
