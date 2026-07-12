import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceApi, type AttendanceDto } from "@/lib/api";
import { toast } from "sonner";
import { getAttendanceLocationString } from "@/lib/attendanceGeolocation";
import {
  toTodayAttendanceView,
  type TodayAttendanceView,
} from "@/lib/attendanceDisplay";

export const NO_SHIFT_MSG =
  "You are not assigned to any shift. Please contact admin.";

export const NO_SHIFT_UNDER_BUTTON =
  "You are not in any shift. Please contact administration.";

export function useTodayAttendance() {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] =
    useState<TodayAttendanceView | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const loadTodayAttendance = useCallback(async () => {
    setLoadingToday(true);
    try {
      const attendance = await attendanceApi.getToday();
      setTodayAttendance(toTodayAttendanceView(attendance));
    } catch (err) {
      console.error("Failed to load attendance:", err);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadTodayAttendance();
    }
  }, [user?.id, loadTodayAttendance]);

  const handleCheckIn = useCallback(async (): Promise<AttendanceDto | null> => {
    setLoadingAttendance(true);
    try {
      const location = await getAttendanceLocationString();
      const result = await attendanceApi.checkIn(location);
      setTodayAttendance(toTodayAttendanceView(result));
      toast.success("Checked in successfully!");
      return result;
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      const errorMessage = e?.message || "Failed to check in";
      if (
        errorMessage.includes("Location") ||
        errorMessage.includes("location")
      ) {
        toast.error(
          "Location access is required for check-in. Please enable location permissions.",
        );
      } else if (e.status === 422 || errorMessage.includes("shift")) {
        toast.error(NO_SHIFT_MSG);
      } else {
        toast.error(errorMessage);
      }
      return null;
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const handleCheckOut = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const location = await getAttendanceLocationString();
      const result = await attendanceApi.checkOut(location);
      setTodayAttendance(toTodayAttendanceView(result));
      toast.success("Checked out successfully!");
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      const errorMessage = e?.message || "Failed to check out";
      if (
        errorMessage.includes("Location") ||
        errorMessage.includes("location")
      ) {
        toast.error(
          "Location access is required for check-out. Please enable location permissions.",
        );
      } else if (e.status === 422 || errorMessage.includes("shift")) {
        toast.error(NO_SHIFT_MSG);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoadingAttendance(false);
    }
  }, []);

  const attendanceBlocked =
    todayAttendance?.hasShiftAssigned === false ||
    todayAttendance?.status === "no_shift";

  return {
    todayAttendance,
    loadingToday,
    loadingAttendance,
    loadTodayAttendance,
    handleCheckIn,
    handleCheckOut,
    attendanceBlocked,
  };
}
