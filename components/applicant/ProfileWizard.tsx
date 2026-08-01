"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { saveOrganizationProfile } from "@/lib/actions/questionnaire";
import type { Organization, Sector } from "@/types/domain";

const STEP_LABELS = ["Organization details", "Sector & size", "Primary contact", "Review & confirm"];

export function ProfileWizard({
  applicationId,
  initialOrg,
  sectors,
}: {
  applicationId: string;
  initialOrg: Organization;
  sectors: Sector[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    name: initialOrg.name,
    rcNumber: initialOrg.rcNumber,
    yearFounded: initialOrg.yearFounded || new Date().getFullYear(),
    address: initialOrg.address,
    sectorId: initialOrg.sectorId,
    employeeHeadcount: initialOrg.employeeHeadcount || "1–10",
    primaryContactName: initialOrg.primaryContactName,
    primaryContactEmail: initialOrg.primaryContactEmail,
  });

  function update<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function next() {
    setError(null);
    if (step === 0 && (!fields.name.trim() || !fields.rcNumber.trim())) {
      setError("Organization name and RC number are required.");
      return;
    }
    if (step === 2 && (!fields.primaryContactName.trim() || !fields.primaryContactEmail.trim())) {
      setError("Primary contact name and email are required.");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function saveDraft() {
    startTransition(async () => {
      await saveOrganizationProfile(applicationId, fields);
    });
  }

  function confirmAndContinue() {
    startTransition(async () => {
      const result = await saveOrganizationProfile(applicationId, fields);
      if (result.success) router.push("/applicant/questionnaire");
    });
  }

  return (
    <div className="flex flex-col lg:flex-row">
      <aside className="lg:w-[280px] lg:border-r border-border px-6 sm:px-8 lg:px-6 py-6">
        <div className="hidden lg:block">
          <div className="text-xs font-bold tracking-wide text-[#AEB1BC] mb-[18px]">SETUP STEPS</div>
          <div className="flex flex-col gap-5">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex gap-3 items-center">
                <div
                  className={
                    "w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center " +
                    (i <= step ? "bg-navy text-white" : "border-[1.5px] border-[#E3E4EA] text-[#AEB1BC]")
                  }
                >
                  {i + 1}
                </div>
                <div className={"text-sm " + (i === step ? "font-semibold text-text" : i < step ? "text-text" : "text-[#AEB1BC]")}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:hidden">
          <ProgressBar percent={((step + 1) / 4) * 100} />
          <div className="text-xs text-text-muted mt-2">
            Step {step + 1} of 4 — {STEP_LABELS[step]}
          </div>
        </div>
      </aside>

      <div className="flex-1 px-6 sm:px-8 lg:px-13 py-8 lg:py-10 max-w-2xl">
        <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-navy mb-6">{STEP_LABELS[step]}</h1>

        {error && <div className="text-sm text-error mb-4">{error}</div>}

        {step === 0 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Label>Registered organization name</Label>
              <Input value={fields.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <Label>RC / registration number</Label>
              <Input value={fields.rcNumber} onChange={(e) => update("rcNumber", e.target.value)} />
            </div>
            <div>
              <Label>Year founded</Label>
              <Input
                type="number"
                value={fields.yearFounded}
                onChange={(e) => update("yearFounded", Number(e.target.value))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Registered address</Label>
              <Input value={fields.address} onChange={(e) => update("address", e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label>Industry / sector</Label>
              <Select value={fields.sectorId} onChange={(e) => update("sectorId", e.target.value)}>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Employee headcount</Label>
              <Select value={fields.employeeHeadcount} onChange={(e) => update("employeeHeadcount", e.target.value)}>
                {["1–10", "10–50", "50–250", "250–1000", "1000+"].map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label>Primary contact name</Label>
              <Input value={fields.primaryContactName} onChange={(e) => update("primaryContactName", e.target.value)} />
            </div>
            <div>
              <Label>Primary contact email</Label>
              <Input
                type="email"
                value={fields.primaryContactEmail}
                onChange={(e) => update("primaryContactEmail", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3 text-sm">
            <SummaryRow label="Organization" value={fields.name} />
            <SummaryRow label="RC number" value={fields.rcNumber} />
            <SummaryRow label="Year founded" value={String(fields.yearFounded)} />
            <SummaryRow label="Address" value={fields.address} />
            <SummaryRow label="Sector" value={sectors.find((s) => s.id === fields.sectorId)?.name ?? ""} />
            <SummaryRow label="Employee headcount" value={fields.employeeHeadcount} />
            <SummaryRow label="Primary contact" value={`${fields.primaryContactName} · ${fields.primaryContactEmail}`} />
          </div>
        )}

        <div className="mt-9 flex justify-between gap-3">
          <div>
            {step > 0 && (
              <Button variant="secondary" onClick={back} disabled={isPending}>
                ← Previous
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={saveDraft} disabled={isPending}>
              Save draft
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={isPending}>
                Continue
              </Button>
            ) : (
              <Button onClick={confirmAndContinue} disabled={isPending}>
                Confirm & continue →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2.5">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-right">{value || "—"}</span>
    </div>
  );
}
