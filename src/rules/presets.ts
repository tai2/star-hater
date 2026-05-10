import type { Rule } from "./types";

export const PRESETS: ReadonlyArray<Rule> = [
  {
    id: "preset.github.repo-stars",
    label: "GitHub: hide repository star counts",
    urlPattern: "https://github.com/*",
    selector: '#repo-stars-counter-star, a[href$="/stargazers"]',
    enabled: true,
    source: "preset",
  },
  {
    id: "preset.github.repo-forks",
    label: "GitHub: hide repository fork counts",
    urlPattern: "https://github.com/*",
    selector:
      '#repo-network-counter, a[href$="/forks"], a[href$="/network/members"]',
    enabled: true,
    source: "preset",
  },
  {
    id: "preset.gitlab.repo-stars",
    label: "GitLab: hide repository star counts",
    urlPattern: "https://gitlab.com/*",
    selector:
      '[data-testid="stars-count"], .star-count, a[href$="/-/starrers"]',
    enabled: true,
    source: "preset",
  },
  {
    id: "preset.gitlab.repo-forks",
    label: "GitLab: hide repository fork counts",
    urlPattern: "https://gitlab.com/*",
    selector: '[data-testid="forks-count"], .fork-count, a[href$="/-/forks"]',
    enabled: true,
    source: "preset",
  },
  {
    id: "preset.x.engagement-counts",
    label: "X / Twitter: hide like and repost counts",
    urlPattern: "https://x.com/*",
    selector:
      '[data-testid="like"] [data-testid="app-text-transition-container"], [data-testid="retweet"] [data-testid="app-text-transition-container"]',
    enabled: true,
    source: "preset",
  },
  {
    id: "preset.twitter.engagement-counts",
    label: "Twitter (legacy): hide like and repost counts",
    urlPattern: "https://twitter.com/*",
    selector:
      '[data-testid="like"] [data-testid="app-text-transition-container"], [data-testid="retweet"] [data-testid="app-text-transition-container"]',
    enabled: true,
    source: "preset",
  },
];
