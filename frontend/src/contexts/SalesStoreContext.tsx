import React, { createContext, useContext, useState, useCallback } from "react";
import { Sale } from "@/data/mockData";
import { salesApi, SaleDto } from "@/lib/api";

function toSale(d: SaleDto): Sale {
  return {
    id: d.id,
    companyId: d.companyId,
    category: d.category as Sale["category"],
    prospect: d.prospect,
    expectedClosingDate: d.expectedClosingDate?.split?.("T")[0] ?? d.expectedClosingDate ?? "",
    expectedRevenue: typeof d.expectedRevenue === "number" ? d.expectedRevenue : parseFloat(String(d.expectedRevenue)) || 0,
    status: d.status as Sale["status"],
    nextAction: d.nextAction ?? "",
    nextActionDate: d.nextActionDate?.split?.("T")[0] ?? d.nextActionDate ?? "",
    createdByUserId: d.createdByUserId ?? "",
    createdAt: d.createdAt?.split?.("T")[0] ?? d.createdAt ?? "",
  };
}

export type SalesListParams = {
  status?: string;
  companyId?: string;
  category?: string;
  createdByUserId?: string;
  search?: string;
};

interface SalesStoreContextType {
  sales: Sale[];
  fetchSales: (params?: SalesListParams) => Promise<void>;
  addSale: (sale: Omit<Sale, "id" | "createdAt">) => Promise<Sale>;
  updateSale: (id: string, updates: Partial<Pick<Sale, "prospect" | "companyId" | "category" | "expectedClosingDate" | "expectedRevenue" | "nextAction" | "nextActionDate">>) => Promise<void>;
  changeStatus: (id: string, newStatus: Sale["status"], note: string, changedByUserId: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  getSale: (id: string) => Sale | undefined;
}

const SalesStoreContext = createContext<SalesStoreContextType | null>(null);

export const SalesStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sales, setSales] = useState<Sale[]>([]);

  const fetchSales = useCallback(async (params?: SalesListParams) => {
    const list = await salesApi.list(params);
    setSales(list.map(toSale));
  }, []);

  const addSale = useCallback(async (saleData: Omit<Sale, "id" | "createdAt">) => {
    const created = await salesApi.create({
      prospect: saleData.prospect,
      companyId: saleData.companyId,
      category: saleData.category,
      expectedClosingDate: saleData.expectedClosingDate,
      expectedRevenue: saleData.expectedRevenue,
      status: saleData.status,
      createdByUserId: saleData.createdByUserId || undefined,
    });
    const newSale = toSale(created);
    setSales((prev) => [newSale, ...prev]);
    return newSale;
  }, []);

  const updateSale = useCallback(async (id: string, updates: Partial<Pick<Sale, "prospect" | "companyId" | "category" | "expectedClosingDate" | "expectedRevenue" | "nextAction" | "nextActionDate">>) => {
    const updated = await salesApi.update(id, updates);
    setSales((prev) => prev.map((s) => (s.id === id ? toSale(updated) : s)));
  }, []);

  const changeStatus = useCallback(async (id: string, newStatus: Sale["status"], note: string, changedByUserId: string) => {
    const updated = await salesApi.patchStatus(id, { status: newStatus, note, changedByUserId });
    setSales((prev) => prev.map((s) => (s.id === id ? toSale(updated) : s)));
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    await salesApi.delete(id);
    setSales((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const getSale = useCallback((saleId: string) => sales.find((s) => s.id === saleId), [sales]);

  return (
    <SalesStoreContext.Provider value={{ sales, fetchSales, addSale, updateSale, changeStatus, deleteSale, getSale }}>
      {children}
    </SalesStoreContext.Provider>
  );
};

export const useSalesStore = () => {
  const ctx = useContext(SalesStoreContext);
  if (!ctx) throw new Error("useSalesStore must be inside SalesStoreProvider");
  return ctx;
};
