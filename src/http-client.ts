import type { CreateTaskInput, FactoryClient, HandOffInput, Task } from "./client.js";

type Fetch = typeof fetch;

/** FactoryClient over HTTP + bearer token. fetch is injectable for tests. */
export function createHttpClient(baseUrl: string, token: string, fetchImpl: Fetch = fetch): FactoryClient {
  const base = baseUrl.replace(/\/+$/, "");
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`factory ${method} ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }
  return {
    listTasks: () => call<Task[]>("GET", "/tasks"),
    getTask: (id) => call<Task>("GET", `/tasks/${encodeURIComponent(id)}`),
    createTask: (input: CreateTaskInput) => call<Task>("POST", "/tasks", input),
    handOffTask: ({ id, ...rest }: HandOffInput) =>
      call<Task>("POST", `/tasks/${encodeURIComponent(id)}/hand-off`, rest),
    approvePlan: (id) => call<unknown>("POST", `/runs/${encodeURIComponent(id)}/approve`, {}),
    steer: ({ id, message }) => call<unknown>("POST", `/runs/${encodeURIComponent(id)}/steer`, { message }),
    queueFollowup: ({ id, message }) =>
      call<unknown>("POST", `/runs/${encodeURIComponent(id)}/queue`, { message }),
    retry: (id) => call<unknown>("POST", `/runs/${encodeURIComponent(id)}/retry`, {}),
    listEvents: (id) => call<unknown>("GET", `/runs/${encodeURIComponent(id)}/events`),
    spend: () => call<unknown>("GET", "/spend"),
    listRepos: () => call<unknown>("GET", "/repos"),
    listPlugins: () => call<unknown>("GET", "/plugins"),
  };
}
