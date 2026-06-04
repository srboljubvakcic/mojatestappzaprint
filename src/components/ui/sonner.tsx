import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      expand
      duration={3500}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto !rounded-2xl !border !border-border !bg-card/95 !backdrop-blur-xl !text-foreground !shadow-[0_10px_40px_-12px_oklch(0_0_0/0.18)] !px-4 !py-3",
          title: "!font-semibold !text-sm tracking-tight",
          description: "!text-muted-foreground !text-xs",
          actionButton:
            "!rounded-full !bg-primary !text-primary-foreground !px-3 !py-1 !text-xs",
          cancelButton:
            "!rounded-full !bg-muted !text-muted-foreground !px-3 !py-1 !text-xs",
          success: "!bg-success/10 !text-success-foreground !border-success/30",
          error: "!bg-destructive/10 !text-destructive !border-destructive/30",
          warning: "!bg-warning/10 !text-warning-foreground !border-warning/30",
          info: "!bg-primary/5 !text-foreground !border-primary/20",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
