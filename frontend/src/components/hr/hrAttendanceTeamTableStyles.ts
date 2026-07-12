/** Fixed 6-column grid: date → employee → department → in time → out time → status */
export const HR_ATT_TEAM_COL_GRID =
  "grid grid-cols-[minmax(108px,0.9fr)_minmax(200px,1.45fr)_minmax(112px,1fr)_minmax(132px,1.05fr)_minmax(132px,1.05fr)_minmax(128px,0.9fr)] items-center gap-x-3";

export const HR_ATT_TEAM_TABLE_MIN_W = "min-w-[980px]";

export const HR_ATT_TEAM_LIST_HPAD = "px-5 sm:px-6";

export const HR_ATT_TEAM_DATE_PL = "pl-2.5";

export const HR_ATT_TEAM_COLUMNS = [
  "Date",
  "Employee",
  "Department",
  "In time",
  "Out time",
  "Status",
] as const;
