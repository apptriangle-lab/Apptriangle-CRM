import { useEffect, useMemo, useState } from "react";
import {
  buildProjectTypeColorIndexMap,
  projectTypeChipClass,
  projectTypeDotClass,
} from "@/components/pms/projectTypeChipStyles";
import { settingsService, type ProjectTypeDto } from "@/services/settingsService";

export function useProjectTypeColorMap(options?: ProjectTypeDto[]) {
  const [fetchedTypes, setFetchedTypes] = useState<ProjectTypeDto[]>([]);

  useEffect(() => {
    if (options) return;
    settingsService
      .listProjectTypes()
      .then(setFetchedTypes)
      .catch(() => setFetchedTypes([]));
  }, [options]);

  const types = options ?? fetchedTypes;

  const colorIndexById = useMemo(() => buildProjectTypeColorIndexMap(types), [types]);

  const getColorIndex = (typeId?: string | null) =>
    typeId ? colorIndexById.get(typeId) : undefined;

  const getChipClass = (typeId?: string | null) =>
    projectTypeChipClass(typeId, getColorIndex(typeId));

  const getDotClass = (typeId?: string | null) =>
    projectTypeDotClass(typeId, getColorIndex(typeId));

  return { types, colorIndexById, getColorIndex, getChipClass, getDotClass };
}
