export const STATUS_LABEL = {
  pending: "Na čekanju",
  in_progress: "U obradi",
  printed: "Štampano",
  shipped: "Poslato",
  completed: "Završeno",
  cancelled: "Otkazano",
} as const;

export const STATUS_STYLES = {
  pending: "bg-warning/15 text-warning-foreground",
  in_progress: "bg-primary/10 text-primary",
  printed: "bg-accent text-accent-foreground",
  shipped: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
} as const;

export const STATUS_ORDER = [
  "pending",
  "in_progress",
  "printed",
  "shipped",
  "completed",
  "cancelled",
] as const;
