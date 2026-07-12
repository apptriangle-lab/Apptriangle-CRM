import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { rbacApi, type PageAccessType } from "@/lib/api";

export type RbacRefreshOptions = { /** Skip global loading overlay (keeps scroll / layout). */ silent?: boolean };

type RbacContextValue = {
  /** Modules this user may access (full set for global admin; explicit RBAC for standard users). */
  navPageKeys: Set<string>;
  /** Per-module effective access: none | user | admin (from /api/rbac/me). */
  effective: Record<string, PageAccessType>;
  loading: boolean;
  refresh: (options?: RbacRefreshOptions) => Promise<Set<string>>;
  canAccessModule: (pageKey: string) => boolean;
  /** Data scope for a module: admin = all rows; user = own / assigned; none = no access. */
  getPageAccess: (pageKey: string) => PageAccessType;
  isPageScopeAdmin: (pageKey: string) => boolean;
};

const RbacContext = createContext<RbacContextValue | null>(null);

export function RbacProvider({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const isGlobalAdmin = user?.role === "admin";
  const [navPageKeys, setNavPageKeys] = useState<Set<string>>(() => new Set());
  const [effective, setEffective] = useState<Record<string, PageAccessType>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (options?: RbacRefreshOptions): Promise<Set<string>> => {
    if (!user) {
      setNavPageKeys(new Set());
      setEffective({});
      setLoading(false);
      return new Set();
    }
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
    }
    try {
      const res = await rbacApi.getMyEffective();
      const keys = new Set(res.navPageKeys ?? []);
      setNavPageKeys(keys);
      setEffective(res.effective ?? {});
      return keys;
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      // Invalid or expired session — clear storage instead of showing "No module access".
      if (status === 401) {
        setNavPageKeys(new Set());
        setEffective({});
        setLoading(false);
        logout();
        return new Set();
      }
      setNavPageKeys(new Set());
      setEffective({});
      return new Set();
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [user, logout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canAccessModule = useCallback(
    (pageKey: string) => isGlobalAdmin || navPageKeys.has(pageKey),
    [navPageKeys, isGlobalAdmin],
  );

  const getPageAccess = useCallback(
    (pageKey: string): PageAccessType => (isGlobalAdmin ? "admin" : effective[pageKey] ?? "none"),
    [effective, isGlobalAdmin],
  );

  const isPageScopeAdmin = useCallback(
    (pageKey: string) => getPageAccess(pageKey) === "admin",
    [getPageAccess],
  );

  const value = useMemo(
    () => ({
      navPageKeys,
      effective,
      loading,
      refresh,
      canAccessModule,
      getPageAccess,
      isPageScopeAdmin,
    }),
    [navPageKeys, effective, loading, refresh, canAccessModule, getPageAccess, isPageScopeAdmin],
  );

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}

export function useRbac() {
  const ctx = useContext(RbacContext);
  if (!ctx) throw new Error("useRbac must be used within RbacProvider");
  return ctx;
}
