import { APP_GITHUB_REPOSITORY } from "./app-status";

export type ReleaseLookup = () => Promise<string | null>;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export function createLatestReleaseLookup(
  fetchImpl: FetchLike = globalThis.fetch,
): ReleaseLookup {
  return async () => {
    const response = await fetchImpl(
      `https://api.github.com/repos/${APP_GITHUB_REPOSITORY.owner}/${APP_GITHUB_REPOSITORY.repo}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "gitcha",
        },
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as { tag_name?: string; name?: string };
    return payload.tag_name ?? payload.name ?? null;
  };
}
