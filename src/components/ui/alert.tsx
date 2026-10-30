import * as React from "react";
import { cn } from "@/lib/utils";

/** Caixa de mensagem (erro ou aviso). */
function Alert({ className, variant = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variant === "destructive" ? "border-destructive/40 bg-destructive/5 text-destructive" : "bg-card",
        className,
      )}
      {...props}
    />
  );
}

export { Alert };
