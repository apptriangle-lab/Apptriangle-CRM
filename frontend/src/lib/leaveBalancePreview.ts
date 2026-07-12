import type { EmployeeLeaveBalanceRowDto, LeaveDto } from "@/lib/api";

export function formatLeaveDays(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function consumedDaysForBalance(leave: LeaveDto): number {
  const raw = leave.totalLeaveDays ?? leave.workingDays;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function daysFromEntitlement(leave: LeaveDto): number {
  const days = consumedDaysForBalance(leave);
  const add = Number(leave.additionalLeaveDays) || 0;
  return Math.max(0, days - add);
}

export function computeLeaveTypeBalance(
  balanceRow: EmployeeLeaveBalanceRowDto | undefined,
  userLeaves: LeaveDto[],
  userId: string,
  leaveTypeId: string,
): { credited: number; remaining: number; additionalOutstanding: number } {
  if (!balanceRow) {
    return { credited: 0, remaining: 0, additionalOutstanding: 0 };
  }

  const credited = Math.max(0, Number(balanceRow.balance) || 0);
  const approvedForType = userLeaves.filter(
    (l) =>
      l.userId === userId &&
      l.status === "approved" &&
      l.leaveTypeId === leaveTypeId,
  );
  const usedFromEntitlement = approvedForType.reduce(
    (sum, l) => sum + daysFromEntitlement(l),
    0,
  );
  const additionalApprovedOnly = approvedForType.reduce(
    (sum, l) => sum + (Number(l.additionalLeaveDays) || 0),
    0,
  );

  const useServerBalance =
    typeof balanceRow.remainingBalance === "number" &&
    typeof balanceRow.additionalOutstanding === "number";

  const remaining = useServerBalance
    ? Math.max(0, balanceRow.remainingBalance)
    : Math.max(0, credited - usedFromEntitlement);
  const additionalOutstanding = useServerBalance
    ? Math.max(0, balanceRow.additionalOutstanding)
    : additionalApprovedOnly;

  return { credited, remaining, additionalOutstanding };
}

export type LeaveApprovalBalancePreview = {
  credited: number;
  remaining: number;
  additionalOutstanding: number;
  requestedDays: number;
  additionalIfApproved: number;
  remainingAfterApproval: number;
};

export function computeApprovalBalancePreview(
  balanceRow: EmployeeLeaveBalanceRowDto | undefined,
  userLeaves: LeaveDto[],
  leave: LeaveDto,
  requestedDays: number,
): LeaveApprovalBalancePreview {
  const base = computeLeaveTypeBalance(
    balanceRow,
    userLeaves,
    leave.userId,
    leave.leaveTypeId,
  );

  const storedAdditional = Number(leave.additionalLeaveDays) || 0;
  const additionalIfApproved =
    storedAdditional > 0
      ? storedAdditional
      : Math.max(0, requestedDays - base.remaining);
  const entitlementUsed = Math.max(0, requestedDays - additionalIfApproved);
  const remainingAfterApproval = Math.max(0, base.remaining - entitlementUsed);

  return {
    ...base,
    requestedDays,
    additionalIfApproved,
    remainingAfterApproval,
  };
}
