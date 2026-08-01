"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { setAdvancementThreshold } from "@/lib/actions/settings";

export function ThresholdSlider({ initialValue, belowCount, total }: { initialValue: number; belowCount: number; total: number }) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="border border-border rounded-2xl p-7 max-w-xl">
      <div className="font-heading font-extrabold text-base text-navy mb-1.5">Advancement threshold</div>
      <p className="text-[13px] text-text-muted mb-5.5 leading-relaxed">
        Minimum preliminary (Secretariat completeness) score an applicant needs to advance from initial review into
        jury scoring. Applicants below this line are not sent to jurors.
      </p>
      <label className="text-[13px] font-semibold block mb-2.5">Minimum score to advance to jury (out of 100)</label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setSaved(false);
          }}
          className="flex-1 accent-navy"
        />
        <div className="w-16 text-center font-heading font-extrabold text-xl text-navy bg-[#F1F1FB] rounded-xl py-2">
          {value}
        </div>
      </div>
      <div className="text-xs text-[#AEB1BC] mt-2.5">
        Currently {belowCount} of {total} applicants fall below this threshold.
      </div>
      <div className="mt-6 flex justify-end items-center gap-3">
        {saved && <span className="text-xs text-success">Saved</span>}
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await setAdvancementThreshold(value);
              setSaved(true);
            })
          }
        >
          Save threshold
        </Button>
      </div>
    </div>
  );
}
