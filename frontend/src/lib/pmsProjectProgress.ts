/** Task-like input for client-side project progress calculation. */
export type PmsTaskProgressInput = { status: string };

export type PmsProjectProgressStats = {
  totalTaskCount: number;
  completedTaskCount: number;
  cancelledTaskCount: number;
  nonCancelledTaskCount: number;
  progressPercentage: number;
};

export type PmsProjectTaskStatsDto = {
  total: number;
  completed: number;
  cancelled?: number;
  nonCancelled?: number;
  progressPercentage?: number;
};

function normalizeStatus(status: string): string {
  return (status || "").trim().toLowerCase().replace(/\s+/g, "_");
}

/** Cancelled/canceled tasks are excluded from the progress denominator. */
export function isPmsTaskCancelledStatus(status: string): boolean {
  const v = normalizeStatus(status);
  return v === "cancelled" || v === "canceled";
}

/** Only `completed` tasks count toward progress numerator. */
export function isPmsTaskCompletedStatus(status: string): boolean {
  return normalizeStatus(status) === "completed";
}

/**
 * Compute project progress from a task list.
 * Cancelled tasks are excluded from the denominator; zero tasks or all cancelled => 0%.
 */
export function calculateProjectProgress(tasks: PmsTaskProgressInput[]): PmsProjectProgressStats {
  const totalTaskCount = tasks.length;
  let completedTaskCount = 0;
  let cancelledTaskCount = 0;

  for (const task of tasks) {
    if (isPmsTaskCancelledStatus(task.status)) {
      cancelledTaskCount += 1;
    } else if (isPmsTaskCompletedStatus(task.status)) {
      completedTaskCount += 1;
    }
  }

  const nonCancelledTaskCount = totalTaskCount - cancelledTaskCount;
  const progressPercentage =
    nonCancelledTaskCount > 0
      ? Math.round((completedTaskCount / nonCancelledTaskCount) * 100)
      : 0;

  return {
    totalTaskCount,
    completedTaskCount,
    cancelledTaskCount,
    nonCancelledTaskCount,
    progressPercentage,
  };
}

/** Resolve progress from API taskStats (list/detail) with safe fallbacks. */
export function progressFromTaskStats(
  taskStats?: PmsProjectTaskStatsDto | null,
): PmsProjectProgressStats {
  if (!taskStats) {
    return {
      totalTaskCount: 0,
      completedTaskCount: 0,
      cancelledTaskCount: 0,
      nonCancelledTaskCount: 0,
      progressPercentage: 0,
    };
  }

  const totalTaskCount = taskStats.total ?? 0;
  const completedTaskCount = taskStats.completed ?? 0;
  const cancelledTaskCount = taskStats.cancelled ?? 0;
  const nonCancelledTaskCount =
    taskStats.nonCancelled ?? Math.max(0, totalTaskCount - cancelledTaskCount);

  const progressPercentage =
    taskStats.progressPercentage ??
    (nonCancelledTaskCount > 0
      ? Math.round((completedTaskCount / nonCancelledTaskCount) * 100)
      : 0);

  return {
    totalTaskCount,
    completedTaskCount,
    cancelledTaskCount,
    nonCancelledTaskCount,
    progressPercentage,
  };
}
