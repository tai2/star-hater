export function matchPattern(pattern: string, url: string): boolean {
  try {
    return new MatchPattern(pattern).includes(url);
  } catch {
    return false;
  }
}
