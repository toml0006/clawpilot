import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-xs font-medium text-ink-3 uppercase tracking-wide",
        className
      )}
      {...props}
    />
  );
}

export { Label };
