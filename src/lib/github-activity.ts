export interface ContributionDay {
  date: string;
  count: number;
}

export interface GithubActivity {
  login: string;
  url: string;
  fetchedAt: string;
  publicRepos: number;
  languages: { name: string; share: number }[];
  repos: { name: string; url: string; language: string | null; pushedAt: string }[];
  calendar: ContributionDay[];
}

export interface ActivityStats {
  total: number;
  activeDays: number;
  longestStreak: number;
  busiest: ContributionDay | null;
}

export function activityStats(calendar: ContributionDay[]): ActivityStats {
  let total = 0,
    activeDays = 0,
    streak = 0,
    longestStreak = 0,
    busiest: ContributionDay | null = null;
  for (const day of calendar) {
    total += day.count;
    if (day.count > 0) {
      activeDays++;
      streak++;
      longestStreak = Math.max(longestStreak, streak);
      if (!busiest || day.count > busiest.count) busiest = day;
    } else streak = 0;
  }
  return { total, activeDays, longestStreak, busiest };
}

/** 0 (none) to 4 (busiest), the way GitHub shades its calendar. */
export function contributionLevel(count: number) {
  if (count === 0) return 0;
  if (count < 3) return 1;
  if (count < 6) return 2;
  if (count < 10) return 3;
  return 4;
}

const isDay = (value: unknown): value is { date: string; count: number } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ContributionDay).date === "string" &&
  typeof (value as ContributionDay).count === "number";

/**
 * Fresh numbers in the browser, so the section keeps up between deploys.
 * Anything missing or malformed keeps the build-time snapshot instead.
 */
export async function fetchLiveActivity(
  snapshot: GithubActivity,
  signal: AbortSignal,
): Promise<GithubActivity> {
  const [calendar, repos] = await Promise.allSettled([
    fetch(`https://github-contributions-api.jogruber.de/v4/${snapshot.login}?y=last`, { signal }).then(
      (response) => (response.ok ? response.json() : Promise.reject(response.status)),
    ),
    fetch(`https://api.github.com/users/${snapshot.login}/repos?sort=pushed&per_page=100`, {
      signal,
      headers: { Accept: "application/vnd.github+json" },
    }).then((response) => (response.ok ? response.json() : Promise.reject(response.status))),
  ]);
  const next = { ...snapshot };
  let fresh = false;
  if (calendar.status === "fulfilled" && Array.isArray(calendar.value?.contributions)) {
    const today = new Date().toISOString().slice(0, 10);
    const days = (calendar.value.contributions as unknown[])
      .filter(isDay)
      .filter((day) => day.date <= today)
      .map((day) => ({ date: day.date, count: day.count }));
    if (days.length > 300) {
      next.calendar = days;
      fresh = true;
    }
  }
  if (repos.status === "fulfilled" && Array.isArray(repos.value)) {
    const live = new Map(
      (repos.value as { name?: string; pushed_at?: string }[])
        .filter((repo) => typeof repo.name === "string" && typeof repo.pushed_at === "string")
        .map((repo) => [repo.name!.toLowerCase(), repo.pushed_at!]),
    );
    next.repos = snapshot.repos
      .map((repo) => ({ ...repo, pushedAt: live.get(repo.name.toLowerCase()) ?? repo.pushedAt }))
      .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt));
    fresh = true;
  }
  if (fresh) next.fetchedAt = new Date().toISOString();
  return next;
}
