import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { useRbac } from "@/contexts/RbacContext";
import { AttendanceActionCard } from "@/components/attendance/AttendanceActionCard";
import { AttendanceHistoryTable } from "@/components/attendance/AttendanceHistoryTable";
import { AttendanceHubHeader } from "@/components/attendance/AttendanceHubHeader";
import { AttendanceHistoryPeriodDropdown } from "@/components/attendance/AttendanceHistoryPeriodDropdown";
import { AttendanceMainTabs, type AttendanceMainTab } from "@/components/attendance/AttendanceMainTabs";
import { AttendancePeriodReportCard, AttendanceShiftCard } from "@/components/attendance/AttendanceSummaryCards";
import { LateReconciliationModal } from "@/components/attendance/LateReconciliationModal";
import { ReconciliationRequestsPanel } from "@/components/attendance/ReconciliationRequestsPanel";
import { HrAttendancePanel } from "@/components/hr/HrAttendancePanel";
import { attendanceApi, shiftsApi, usersApi, hrApi } from "@/lib/api";
import type { AttendanceDto, ShiftDto, UserDto, HRInfoDto } from "@/lib/api";
import {
  ATTENDANCE_HISTORY_FILTERS,
  type AttendanceHistoryPeriod,
} from "@/lib/attendanceDisplay";
import {
  ATTENDANCE_CARD,
  lateReconDismissStorageKey,
} from "@/components/attendance/attendanceConstants";
import {
  AttendanceActionCardSkeleton,
  AttendancePeriodReportCardSkeleton,
  AttendanceShiftCardSkeleton,
} from "@/components/attendance/AttendanceSummaryCardSkeletons";
import {
  HrAttendanceTeamFilterBarSkeleton,
  HrAttendanceTeamTableSkeleton,
} from "@/components/hr/HrAttendanceTeamTableSkeleton";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Attendance() {
  const { user } = useAuth();
  const { hrInfo, isLoading: appLoading } = useAppContext();
  const { isPageScopeAdmin } = useRbac();
  const isAttendanceAdmin = isPageScopeAdmin("attendance");

  const [historyPeriod, setHistoryPeriod] =
    useState<AttendanceHistoryPeriod>("week");
  const [records, setRecords] = useState<AttendanceDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [myShift, setMyShift] = useState<ShiftDto | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  const [reconRefresh, setReconRefresh] = useState(0);
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [lateModalAttendance, setLateModalAttendance] = useState<AttendanceDto | null>(null);
  const [lateReconPending, setLateReconPending] = useState<AttendanceDto | null>(null);

  const syncLateReconPending = useCallback((dto: AttendanceDto) => {
    if (dto.status === "late" && dto.id && dto.lateReconciliation?.canSubmit) {
      setLateReconPending(dto);
      return true;
    }
    setLateReconPending(null);
    return false;
  }, []);

  const refreshTodayReconciliation = useCallback(async () => {
    try {
      const dto = await attendanceApi.getToday();
      syncLateReconPending(dto);
      return dto;
    } catch {
      return null;
    }
  }, [syncLateReconPending]);

  const [mainTab, setMainTab] = useState<AttendanceMainTab>("my-history");

  const [teamUsers, setTeamUsers] = useState<UserDto[]>([]);
  const [teamHrData, setTeamHrData] = useState<Record<string, HRInfoDto>>({});
  const [teamShifts, setTeamShifts] = useState<ShiftDto[]>([]);
  const [teamDataLoading, setTeamDataLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await attendanceApi.getRecords(historyPeriod);
      setRecords(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load attendance history");
      setRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPeriod]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!isAttendanceAdmin) {
      setTeamUsers([]);
      setTeamHrData({});
      setTeamShifts([]);
      setMainTab((t) => (t === "team" ? "my-history" : t));
      return;
    }
    let cancelled = false;
    setTeamDataLoading(true);
    void (async () => {
      try {
        const [userList, shiftList] = await Promise.all([
          usersApi.list(),
          shiftsApi.list().catch(() => [] as ShiftDto[]),
        ]);
        if (cancelled) return;
        const hrMap: Record<string, HRInfoDto> = {};
        await Promise.all(
          userList.map(async (u) => {
            try {
              const h = await hrApi.get(u.id);
              hrMap[u.id] = h;
            } catch {
              /* no HR profile */
            }
          }),
        );
        if (cancelled) return;
        setTeamUsers(userList);
        setTeamHrData(hrMap);
        setTeamShifts(shiftList);
      } catch {
        if (!cancelled) toast.error("Failed to load team directory");
      } finally {
        if (!cancelled) setTeamDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAttendanceAdmin]);

  const openLateIfEligible = useCallback(
    (dto: AttendanceDto) => {
      if (!syncLateReconPending(dto) || !dto.id) return;
      if (sessionStorage.getItem(lateReconDismissStorageKey(dto.id))) return;
      setLateModalAttendance(dto);
      setLateModalOpen(true);
    },
    [syncLateReconPending],
  );

  useEffect(() => {
    if (!user?.id) return;
    void attendanceApi.getToday().then(openLateIfEligible).catch(() => {});
  }, [user?.id, openLateIfEligible]);

  useEffect(() => {
    let cancelled = false;
    if (appLoading) {
      setLoadingShift(true);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const sid = hrInfo?.shiftId?.trim();
      if (!sid) {
        setMyShift(null);
        setLoadingShift(false);
        return;
      }
      setLoadingShift(true);
      try {
        const list = await shiftsApi.list();
        if (cancelled) return;
        setMyShift(list.find((s) => s.id === sid) ?? null);
      } catch {
        if (!cancelled) setMyShift(null);
      } finally {
        if (!cancelled) setLoadingShift(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hrInfo?.shiftId, appLoading]);

  const formatShiftTime = (value?: string | null) => {
    if (!value) return "—";
    const [h, m] = value.split(":");
    const hour = Number(h);
    const minute = Number(m);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return format(date, "hh:mm a");
  };

  const periodLabel =
    ATTENDANCE_HISTORY_FILTERS.find((f) => f.value === historyPeriod)?.label ??
    "Selected period";
  const periodPresent = records.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const periodLate = records.filter((r) => r.status === "late").length;
  const periodAbsent = records.filter(
    (r) => r.status !== "present" && r.status !== "late",
  ).length;

  const mainTabs = (
    <AttendanceMainTabs
      value={mainTab}
      onChange={setMainTab}
      showTeamTab={isAttendanceAdmin}
    />
  );

  return (
    <Layout>
      <div className="-m-6 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f9fb] font-[Inter,system-ui,sans-serif]">
        <div className="shrink-0 space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className={cn(ATTENDANCE_CARD, "min-h-0")}>
              <AttendanceActionCard
                variant="page"
                refreshToken={reconRefresh}
                showReconciliationButton={Boolean(lateReconPending) && !lateModalOpen}
                onReconciliationClick={() => {
                  if (!lateReconPending) return;
                  setLateModalAttendance(lateReconPending);
                  setLateModalOpen(true);
                }}
                onAfterMutation={() => {
                  void loadHistory();
                  void refreshTodayReconciliation();
                  setReconRefresh((n) => n + 1);
                }}
                onLateCheckIn={(dto) => {
                  setLateReconPending(dto);
                  setLateModalAttendance(dto);
                  setLateModalOpen(true);
                }}
              />
            </div>
            <AttendanceShiftCard
              myShift={myShift}
              formatShiftTime={formatShiftTime}
              loading={loadingShift}
            />
            <AttendancePeriodReportCard
              periodStats={{
                label: periodLabel,
                records: records.length,
                present: periodPresent,
                late: periodLate,
                absent: periodAbsent,
              }}
              loading={loadingHistory}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-5 sm:pb-5">
          {mainTab === "my-history" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-3">
              <AttendanceHubHeader
                tabs={mainTabs}
                toolbar={
                  <AttendanceHistoryPeriodDropdown
                    value={historyPeriod}
                    onChange={setHistoryPeriod}
                    align="end"
                  />
                }
              />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <AttendanceHistoryTable
                  records={records}
                  loading={loadingHistory}
                  historyPeriod={historyPeriod}
                  onHistoryPeriodChange={setHistoryPeriod}
                  hidePeriodFilter
                />
              </div>
            </div>
          ) : null}

          {mainTab === "team" && isAttendanceAdmin ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {teamDataLoading ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-3">
                  <AttendanceHubHeader tabs={mainTabs} />
                  <HrAttendanceTeamFilterBarSkeleton />
                  <HrAttendanceTeamTableSkeleton withShell />
                </div>
              ) : (
                <HrAttendancePanel
                  users={teamUsers}
                  hrData={teamHrData}
                  shifts={teamShifts}
                  refreshToken={reconRefresh}
                  compactLayout
                  toolbarLeading={mainTabs}
                />
              )}
            </div>
          ) : null}

          {mainTab === "reconciliation" ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ReconciliationRequestsPanel
                isAttendanceAdmin={isAttendanceAdmin}
                refreshToken={reconRefresh}
                onAfterReview={() => setReconRefresh((n) => n + 1)}
                adminFilterUsers={isAttendanceAdmin ? teamUsers : undefined}
                toolbarLeading={mainTabs}
              />
            </div>
          ) : null}
        </div>

        <LateReconciliationModal
          open={lateModalOpen}
          onOpenChange={(open) => {
            setLateModalOpen(open);
            if (!open) setLateModalAttendance(null);
          }}
          attendance={lateModalAttendance}
          onSubmitted={() => {
            setReconRefresh((n) => n + 1);
            void loadHistory();
            void refreshTodayReconciliation().then((dto) => {
              if (!dto?.lateReconciliation?.canSubmit) {
                setLateReconPending(null);
                if (dto?.id) sessionStorage.removeItem(lateReconDismissStorageKey(dto.id));
              }
            });
          }}
          onDismissWithoutSubmit={() => {
            const id = lateModalAttendance?.id;
            if (id) sessionStorage.setItem(lateReconDismissStorageKey(id), "1");
          }}
        />
      </div>
    </Layout>
  );
}
