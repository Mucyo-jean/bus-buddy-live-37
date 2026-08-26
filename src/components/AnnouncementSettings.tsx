import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { THRESHOLD_LIMITS, type TrackingThresholds } from "@/lib/tracking";
import { formatDistance } from "@/lib/geo";

type Props = {
  thresholds: TrackingThresholds;
  onChange: (patch: Partial<TrackingThresholds>) => void;
  onReset: () => void;
};

export function AnnouncementSettings({ thresholds, onChange, onReset }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" />
          Alert settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Announcement thresholds</DialogTitle>
          <DialogDescription>
            Choose how early the app warns you about the next stop and when it counts the bus as arrived.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <Setting
            id="approach-distance"
            label="“Approaching” distance"
            value={formatDistance(thresholds.approachRadiusM)}
            hint="Announced when the bus gets this close to the next stop."
            limits={THRESHOLD_LIMITS.approachRadiusM}
            current={thresholds.approachRadiusM}
            onChange={(v) => onChange({ approachRadiusM: v })}
          />
          <Setting
            id="approach-eta"
            label="“Approaching” time"
            value={thresholds.approachEtaSeconds === 0 ? "Off" : `${thresholds.approachEtaSeconds}s before arrival`}
            hint="Also announces when the estimated arrival drops below this. Set to 0 to use distance only."
            limits={THRESHOLD_LIMITS.approachEtaSeconds}
            current={thresholds.approachEtaSeconds}
            onChange={(v) => onChange({ approachEtaSeconds: v })}
          />
          <Setting
            id="arrival-distance"
            label="“Arrived” distance"
            value={formatDistance(thresholds.arrivalRadiusM)}
            hint="How close the bus must be to a stop to count as arrived."
            limits={THRESHOLD_LIMITS.arrivalRadiusM}
            current={thresholds.arrivalRadiusM}
            onChange={(v) => onChange({ arrivalRadiusM: v })}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset to defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Setting({
  id,
  label,
  value,
  hint,
  limits,
  current,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  limits: { min: number; max: number; step: number };
  current: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-display text-sm font-semibold">{value}</span>
      </div>
      <Slider
        id={id}
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={[current]}
        onValueChange={([v]) => onChange(v ?? current)}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
