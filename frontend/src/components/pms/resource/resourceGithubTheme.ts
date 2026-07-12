/** GitHub contribution-graph greens (light theme). */
export const GITHUB_GREEN = {
  empty: { bg: "#ebedf0", border: "#d0d7de", hover: "#dde3ea" },
  l1: { bg: "#9be9a8", border: "#4ac26b", hover: "#7fdc8c" },
  l2: { bg: "#40c463", border: "#2da44e", hover: "#3fb950" },
  l3: { bg: "#30a14e", border: "#1a7f37", hover: "#2ea043" },
  l4: { bg: "#216e39", border: "#116329", hover: "#1a7f37" },
} as const;

export function githubIntensityLevel(taskCount: number): keyof typeof GITHUB_GREEN {
  if (taskCount <= 0) return "empty";
  if (taskCount === 1) return "l1";
  if (taskCount === 2) return "l2";
  if (taskCount <= 4) return "l3";
  return "l4";
}

export function getGithubDayColors(taskCount: number) {
  return GITHUB_GREEN[githubIntensityLevel(taskCount)];
}
