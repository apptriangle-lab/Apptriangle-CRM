import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PmsHubToolbarContextValue = {
  toolbar: ReactNode | null;
  setToolbar: (node: ReactNode | null) => void;
};

const PmsHubToolbarContext = createContext<PmsHubToolbarContextValue | null>(null);

export function PmsHubToolbarProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ toolbar, setToolbar }), [toolbar]);

  return (
    <PmsHubToolbarContext.Provider value={value}>{children}</PmsHubToolbarContext.Provider>
  );
}

function usePmsHubToolbarContext() {
  const ctx = useContext(PmsHubToolbarContext);
  if (!ctx) {
    throw new Error("usePmsHubToolbarSlot must be used within PmsHubToolbarProvider");
  }
  return ctx;
}

/** Mount page-specific controls (e.g. Resource filters) in the hub header row. */
export function usePmsHubToolbarSlot(content: ReactNode | null) {
  const { setToolbar } = usePmsHubToolbarContext();

  useLayoutEffect(() => {
    setToolbar(content);
    return () => setToolbar(null);
  }, [content, setToolbar]);
}

export function usePmsHubToolbar() {
  return useContext(PmsHubToolbarContext);
}
