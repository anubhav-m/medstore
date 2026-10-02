import { createContext, use, type ReactNode } from "react";
import type { AppKind } from "./density";
import { tokensByApp, type Tokens } from "./tokens";

const DesignContext = createContext<Tokens | null>(null);

interface DesignProviderProps {
  /** Sets the density (customer: comfortable, admin: compact) and which status labels are shown. */
  app: AppKind;
  children: ReactNode;
}

export function DesignProvider({ app, children }: DesignProviderProps) {
  return <DesignContext value={tokensByApp[app]}>{children}</DesignContext>;
}

export function useDesign(): Tokens {
  const tokens = use(DesignContext);
  if (!tokens) {
    throw new Error("useDesign must be used inside <DesignProvider>.");
  }
  return tokens;
}
