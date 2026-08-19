"use client";

import { cn } from "@/lib/utils";
import { Textarea, Input } from "@/components/ui/Field";
import { FREQUENCY_LABELS } from "@/types/domain";
import type { AnswerValue, AssessmentItem } from "@/types/domain";

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function AssessmentItemField({
  item,
  value,
  isNA,
  naJustification,
  onChange,
  readOnly = false,
}: {
  item: AssessmentItem;
  value: AnswerValue;
  isNA: boolean;
  naJustification: string;
  onChange: (value: AnswerValue, isNA: boolean, naJustification: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className={cn("border border-border rounded-2xl p-5", readOnly && "bg-bg")}>
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="text-sm font-semibold">
          <span className="text-text-muted font-mono text-xs mr-2">{item.id}</span>
          {item.prompt}
        </div>
      </div>

      {!isNA && <ResponseControl item={item} value={value} onChange={(v) => onChange(v, false, "")} readOnly={readOnly} />}

      {item.allowNA && (
        <div className="mt-3.5 pt-3.5 border-t border-border">
          <label className={cn("flex items-center gap-2 text-xs text-text-muted", readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
            <input
              type="checkbox"
              checked={isNA}
              disabled={readOnly}
              onChange={(e) => onChange(null, e.target.checked, naJustification)}
              className="w-3.5 h-3.5 accent-navy"
            />
            Not applicable to our organisation
          </label>
          {isNA && (
            <div className="mt-2.5">
              <Textarea
                rows={2}
                placeholder="Briefly explain why this doesn't apply (≤50 words)"
                value={naJustification}
                disabled={readOnly}
                onChange={(e) => onChange(null, true, e.target.value)}
              />
              <div className={cn("text-xs mt-1", wordCount(naJustification) > 50 ? "text-error" : "text-text-muted")}>
                {wordCount(naJustification)}/50 words
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResponseControl({
  item,
  value,
  onChange,
  readOnly,
}: {
  item: AssessmentItem;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  readOnly: boolean;
}) {
  switch (item.responseType) {
    case "yn_na":
      return (
        <div className="flex gap-2">
          <ChoiceButton active={value === true} onClick={() => onChange(true)} disabled={readOnly}>
            Yes
          </ChoiceButton>
          <ChoiceButton active={value === false} onClick={() => onChange(false)} disabled={readOnly}>
            No
          </ChoiceButton>
        </div>
      );
    case "maturity":
      return (
        <div className="flex flex-col gap-2">
          {item.maturityLabels!.map((label, idx) => {
            const level = idx + 1;
            return (
              <ChoiceRow key={level} active={value === level} onClick={() => onChange(level)} disabled={readOnly}>
                <span className="font-bold mr-2">{level}.</span>
                {label}
              </ChoiceRow>
            );
          })}
        </div>
      );
    case "frequency":
      return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {FREQUENCY_LABELS.map((label, idx) => (
            <ChoiceButton key={label} active={value === idx} onClick={() => onChange(idx)} disabled={readOnly}>
              {label}
            </ChoiceButton>
          ))}
        </div>
      );
    case "numeric":
      return (
        <Input
          type="number"
          value={typeof value === "number" ? value : ""}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="max-w-40"
        />
      );
    case "percentage":
      return (
        <div className="relative max-w-40">
          <Input
            type="number"
            min={0}
            max={100}
            value={typeof value === "number" ? value : ""}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted">%</span>
        </div>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-2">
          {item.multiselectOptions!.map((option) => (
            <label key={option} className={cn("flex items-center gap-2 text-sm", readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                disabled={readOnly}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, option] : selected.filter((o) => o !== option))
                }
                className="w-4 h-4 accent-navy"
              />
              {option}
            </label>
          ))}
        </div>
      );
    }
    case "narrative": {
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <Textarea rows={4} placeholder="200–300 words" value={text} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />
          <div className="text-xs text-text-muted mt-1">{wordCount(text)} words</div>
        </div>
      );
    }
    default:
      return null;
  }
}

function ChoiceButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex-1 rounded-xl border-[1.5px] px-3 py-2.5 text-[13px] font-semibold text-center disabled:cursor-not-allowed disabled:opacity-70",
        active ? "bg-navy text-white border-navy" : "border-[#E3E4EA] text-text"
      )}
    >
      {children}
    </button>
  );
}

function ChoiceRow({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "text-left rounded-xl border-[1.5px] px-3.5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-70",
        active ? "bg-[#F1F1FB] border-navy font-semibold" : "border-[#E3E4EA]"
      )}
    >
      {children}
    </button>
  );
}
