"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, Select, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { saveOrganizationProfile } from "@/lib/actions/registration";
import { useScrollTopOnChange } from "@/lib/hooks/useScrollTopOnChange";
import {
  GEOGRAPHICAL_COVERAGE_LABELS,
  ORG_SIZE_LABELS,
  OWNERSHIP_STRUCTURE_LABELS,
  YEAR_ESTABLISHED_LABELS,
} from "@/types/domain";
import type {
  EligibilityDeclarations,
  GeographicalCoverage,
  Organization,
  OrgSizeTier,
  OwnershipStructure,
  Sector,
  YearEstablishedBand,
} from "@/types/domain";

const STEP_LABELS = ["Organisation details", "Structure & coverage", "Contact & history", "Eligibility declarations"];

// Matches the real seeded sectors row this triggers the follow-up field
// for — matched by name rather than a hardcoded id, so it keeps working
// if the sector taxonomy is ever re-seeded with new ids.
const OTHER_SECTOR_NAME = "Other (Please Specify)";

export function ProfileWizard({
  applicationId: initialApplicationId,
  initialOrg,
  initialDeclarations,
  sectors,
}: {
  applicationId: string | null;
  initialOrg: Organization;
  initialDeclarations: EligibilityDeclarations;
  sectors: Sector[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  useScrollTopOnChange(step);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set once the first save creates the application — every save after
  // that updates the same row instead of trying to create another.
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [fields, setFields] = useState({
    name: initialOrg.name,
    rcNumber: initialOrg.rcNumber,
    yearEstablishedBand: initialOrg.yearEstablishedBand,
    sectorId: initialOrg.sectorId,
    sectorOtherDetail: initialOrg.sectorOtherDetail ?? "",
    sizeTier: initialOrg.sizeTier,
    employeeCount: initialOrg.employeeCount,
    geographicalCoverage: initialOrg.geographicalCoverage,
    ownershipStructure: initialOrg.ownershipStructure,
    localOrMultinational: initialOrg.localOrMultinational,
    isUnionised: initialOrg.isUnionised,
    primaryContactName: initialOrg.primaryContactName,
    primaryContactEmail: initialOrg.primaryContactEmail,
    primaryContactPhone: initialOrg.primaryContactPhone,
    previousParticipation: initialOrg.previousParticipation,
  });
  const [declarations, setDeclarations] = useState<EligibilityDeclarations>(initialDeclarations);

  function update<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function next() {
    setError(null);
    if (step === 0 && (!fields.name.trim() || !fields.rcNumber.trim())) {
      setError("Organisation name and RC number are required.");
      return;
    }
    if (step === 0 && sectors.find((s) => s.id === fields.sectorId)?.name === OTHER_SECTOR_NAME && !fields.sectorOtherDetail.trim()) {
      setError("Please specify your sector.");
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

  async function save() {
    setError(null);
    const result = await saveOrganizationProfile(applicationId, fields, declarations);
    if (!result.success) {
      setError(result.error ?? "Could not save profile.");
      return false;
    }
    if (result.applicationId) setApplicationId(result.applicationId);
    return true;
  }

  function saveDraft() {
    startTransition(async () => {
      await save();
    });
  }

  function confirmAndContinue() {
    startTransition(async () => {
      const ok = await save();
      if (ok) router.push("/applicant/questionnaire");
    });
  }

  const allDeclared = Object.values(declarations).every(Boolean);

  return (
    <div className="flex flex-col lg:flex-row">
      <aside className="lg:w-[280px] lg:border-r border-border px-6 sm:px-8 lg:px-6 py-6">
        <div className="hidden lg:block">
          <div className="text-xs font-bold tracking-wide text-[#AEB1BC] mb-[18px]">SECTION A — ELIGIBILITY & REGISTRATION</div>
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
        <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-navy mb-1.5">{STEP_LABELS[step]}</h1>
        {step === 0 && (
          <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
            Section A is not scored — it establishes eligibility and populates your profile used throughout the
            assessment.
          </p>
        )}

        {error && <div className="text-sm text-error mb-4">{error}</div>}

        {step === 0 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <Label>Organisation name</Label>
              <Input value={fields.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <Label>RC number</Label>
              <Input value={fields.rcNumber} onChange={(e) => update("rcNumber", e.target.value)} />
            </div>
            <div>
              <Label>Year established</Label>
              <Select value={fields.yearEstablishedBand} onChange={(e) => update("yearEstablishedBand", e.target.value as YearEstablishedBand)}>
                {Object.entries(YEAR_ESTABLISHED_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Sector</Label>
              <Select
                value={fields.sectorId}
                onChange={(e) => {
                  const newSectorId = e.target.value;
                  const stillOther = sectors.find((s) => s.id === newSectorId)?.name === OTHER_SECTOR_NAME;
                  setFields((f) => ({ ...f, sectorId: newSectorId, sectorOtherDetail: stillOther ? f.sectorOtherDetail : "" }));
                }}
              >
                <option value="">Select a sector</option>
                {Object.entries(
                  sectors.reduce<Record<string, Sector[]>>((groups, s) => {
                    (groups[s.categoryName] ??= []).push(s);
                    return groups;
                  }, {})
                ).map(([categoryName, categorySectors]) => (
                  <optgroup key={categoryName} label={categoryName}>
                    {categorySectors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            {sectors.find((s) => s.id === fields.sectorId)?.name === OTHER_SECTOR_NAME && (
              <div className="sm:col-span-2">
                <Label>Please specify your sector</Label>
                <Input value={fields.sectorOtherDetail} onChange={(e) => update("sectorOtherDetail", e.target.value)} placeholder="e.g. Renewable energy consulting" />
              </div>
            )}
            <div>
              <Label>Organisation size</Label>
              <Select value={fields.sizeTier} onChange={(e) => update("sizeTier", e.target.value as OrgSizeTier)}>
                {Object.entries(ORG_SIZE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Number of employees</Label>
              <Input
                type="number"
                min={0}
                value={fields.employeeCount ?? ""}
                onChange={(e) => update("employeeCount", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label>Geographical coverage</Label>
              <Select
                value={fields.geographicalCoverage}
                onChange={(e) => update("geographicalCoverage", e.target.value as GeographicalCoverage)}
              >
                {Object.entries(GEOGRAPHICAL_COVERAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Ownership structure</Label>
              <Select
                value={fields.ownershipStructure}
                onChange={(e) => update("ownershipStructure", e.target.value as OwnershipStructure)}
              >
                {Object.entries(OWNERSHIP_STRUCTURE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Local or multinational</Label>
              <Select
                value={fields.localOrMultinational}
                onChange={(e) => update("localOrMultinational", e.target.value as "local" | "multinational")}
              >
                <option value="local">Local</option>
                <option value="multinational">Multinational</option>
              </Select>
            </div>
            <div>
              <Label>Is your workforce unionised?</Label>
              <Select
                value={fields.isUnionised ? "yes" : "no"}
                onChange={(e) => update("isUnionised", e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
              <p className="text-xs text-text-muted mt-1.5">
                This determines which Labour Relations (Section D) questions you&rsquo;ll see later.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Label>Contact person full name</Label>
              <Input value={fields.primaryContactName} onChange={(e) => update("primaryContactName", e.target.value)} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input
                type="email"
                value={fields.primaryContactEmail}
                onChange={(e) => update("primaryContactEmail", e.target.value)}
              />
            </div>
            <div>
              <Label>Contact telephone</Label>
              <Input value={fields.primaryContactPhone} onChange={(e) => update("primaryContactPhone", e.target.value)} />
            </div>
            <div>
              <Label>Previous participation in the Awards</Label>
              <Select
                value={fields.previousParticipation.participated ? "yes" : "no"}
                onChange={(e) =>
                  update("previousParticipation", {
                    participated: e.target.value === "yes",
                    years: e.target.value === "yes" ? fields.previousParticipation.years : [],
                  })
                }
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
              {fields.previousParticipation.participated && (
                <Input
                  className="mt-2"
                  placeholder="Year(s), comma-separated e.g. 2024, 2025"
                  value={fields.previousParticipation.years.join(", ")}
                  onChange={(e) =>
                    update("previousParticipation", {
                      participated: true,
                      years: e.target.value.split(",").map((y) => y.trim()).filter(Boolean),
                    })
                  }
                />
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-text-muted leading-relaxed mb-1">
              Each declaration below is required before proceeding. If any is unchecked, your application will still
              be accepted but flagged for Secretariat review rather than rejected outright, in case of a genuine
              documentation gap that can be resolved before Stage 2.
            </p>
            <Checkbox
              label="Our organisation is legally registered in Nigeria."
              checked={declarations.legallyRegistered}
              onChange={(e) => setDeclarations((d) => ({ ...d, legallyRegistered: e.target.checked }))}
            />
            <Checkbox
              label="Our organisation is tax-compliant."
              checked={declarations.taxCompliant}
              onChange={(e) => setDeclarations((d) => ({ ...d, taxCompliant: e.target.checked }))}
            />
            <Checkbox
              label="Our organisation is not currently under any regulatory sanction."
              checked={declarations.notUnderSanction}
              onChange={(e) => setDeclarations((d) => ({ ...d, notUnderSanction: e.target.checked }))}
            />
            <Checkbox
              label="The information provided in this application is accurate."
              checked={declarations.infoAccurate}
              onChange={(e) => setDeclarations((d) => ({ ...d, infoAccurate: e.target.checked }))}
            />
            {!allDeclared && (
              <div className="text-xs text-warning mt-1">
                One or more declarations are unchecked — this will flag your application for Secretariat review.
              </div>
            )}
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
            <Button variant="secondary" onClick={saveDraft} loading={isPending}>
              Save draft
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={isPending}>
                Continue
              </Button>
            ) : (
              <Button onClick={confirmAndContinue} loading={isPending}>
                Confirm & continue →
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
