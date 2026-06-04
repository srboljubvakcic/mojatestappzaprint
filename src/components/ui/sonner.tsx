import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      closeButton
      expand
      duration={3500}
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group pointer-events-auto !rounded-2xl !border !px-4 !py-3.5 !shadow-[0_12px_40px_-12px_oklch(0_0_0/0.25)] !backdrop-blur-xl",
          default:
            "!bg-card !text-foreground !border-border",
          title: "!font-semibold !text-sm !tracking-tight",
          description: "!text-xs !opacity-90",
          actionButton:
            "!rounded-full !bg-foreground !text-background !px-3 !py-1 !text-xs !font-medium",
          cancelButton:
            "!rounded-full !bg-muted !text-muted-foreground !px-3 !py-1 !text-xs",
          closeButton:
            "!bg-card !border !border-border !text-foreground hover:!bg-accent",
          success:
            "!bg-[oklch(0.97_0.04_155)] !text-[oklch(0.32_0.10_155)] !border-[oklch(0.78_0.14_155)]",
          error:
            "!bg-[oklch(0.97_0.04_25)] !text-[oklch(0.36_0.18_25)] !border-[oklch(0.78_0.18_25)]",
          warning:
            "!bg-[oklch(0.97_0.05_85)] !text-[oklch(0.38_0.13_75)] !border-[oklch(0.82_0.16_85)]",
          info:
            "!bg-[oklch(0.97_0.03_250)] !text-[oklch(0.32_0.14_265)] !border-[oklch(0.78_0.12_265)]",
          loading:
            "!bg-card !text-foreground !border-border",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
