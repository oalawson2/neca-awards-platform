"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { setAvailability } from "@/lib/actions/interviews";
import type { InterviewAvailabilitySlot } from "@/types/domain";

const TIMES = ["09:00", "10:00", "11:00", "14:00"];
const TIME_LABELS: Record<string, string> = { "09:00": "9:00", "10:00": "10:00", "11:00": "11:00", "14:00": "2:00" };

function nextWeekdays(count: number): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  const cursor = new Date();
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push({
        date: cursor.toISOString().slice(0, 10),
        label: cursor.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }
  }
  return days;
}

function slotKey(date: string, time: string) {
  return `${date}_${time}`;
}

export function AvailabilityGrid({ jurorId, existingSlots }: { jurorId: string; existingSlots: InterviewAvailabilitySlot[] }) {
  const days = useMemo(() => nextWeekdays(5), []);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(existingSlots.map((s) => slotKey(s.date, s.startTime)))
  );
  const [dayIndex, setDayIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(date: string, time: string) {
    const key = slotKey(date, time);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }

  function save() {
    const slots = Array.from(selected).map((key) => {
      const [date, startTime] = key.split("_");
      const endTime = `${startTime.slice(0, 2)}:30`;
      return { date, startTime, endTime };
    });
    startTransition(async () => {
      await setAvailability(jurorId, slots);
      setSaved(true);
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-15 py-8 sm:py-9">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-jury mb-1.5">Set your interview availability</h1>
      <p className="text-[13px] text-text-muted mb-7">Toggle 30-minute blocks you&rsquo;re free for panel interviews.</p>

      {/* Desktop/tablet grid */}
      <div className="hidden sm:block">
        <div className="grid gap-0.5 bg-border border border-border rounded-2xl overflow-hidden" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
          <div className="bg-white p-2.5" />
          {days.map((d) => (
            <div key={d.date} className="bg-white p-2.5 text-xs font-bold text-center">
              {d.label}
            </div>
          ))}
          {TIMES.map((time) => (
            <div key={time} className="contents">
              <div className="bg-white p-2.5 text-xs text-[#AEB1BC]">{TIME_LABELS[time]}</div>
              {days.map((d) => {
                const active = selected.has(slotKey(d.date, time));
                return (
                  <button
                    key={d.date}
                    onClick={() => toggle(d.date, time)}
                    className={cn(active ? "bg-navy rounded-lg m-0.5" : "bg-white")}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-3.5 mt-4.5 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-navy" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-white border border-border" /> Unavailable
          </span>
        </div>
      </div>

      {/* Mobile: one day at a time */}
      <div className="sm:hidden">
        <div className="flex gap-1.5 overflow-x-auto mb-3.5">
          {days.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setDayIndex(i)}
              className={cn(
                "flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold",
                i === dayIndex ? "bg-navy text-white" : "bg-[#F4F4F8] text-text-muted"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {TIMES.map((time) => {
            const active = selected.has(slotKey(days[dayIndex].date, time));
            return (
              <button
                key={time}
                onClick={() => toggle(days[dayIndex].date, time)}
                className="flex justify-between items-center border border-border rounded-xl px-4 py-3"
              >
                <span className="text-sm">{TIME_LABELS[time]} AM/PM</span>
                <span className={cn("w-10 h-5.5 rounded-full relative", active ? "bg-navy" : "bg-border")}>
                  <span
                    className={cn(
                      "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-all",
                      active ? "right-0.5" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end items-center gap-3 mt-6.5">
        {saved && <span className="text-xs text-success">Saved</span>}
        <Button disabled={isPending} onClick={save}>
          Save availability
        </Button>
      </div>
    </div>
  );
}
