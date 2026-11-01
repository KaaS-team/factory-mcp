/** Small interface to the factory. Injected into the server; faked in tests. */
export interface Task {
  id: string;
  title: string;
  status: string;
  assignee?: string;
}

export interface CreateTaskInput {
  title: string;
  body?: string;
}

export interface HandOffInput {
  id: string;
  to: string;
  note?: string;
}

/** Message aimed at a run (steer or queue). */
export interface RunMessageInput {
  id: string;
  message: string;
}

/**
 * Bodies of the read routes below are passed through as the route returned
 * them; the client does not reshape them.
 */
export interface FactoryClient {
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  createTask(input: CreateTaskInput): Promise<Task>;
  handOffTask(input: HandOffInput): Promise<Task>;
  /** runs.approve */
  approvePlan(id: string): Promise<unknown>;
  /** runs.steer */
  steer(input: RunMessageInput): Promise<unknown>;
  /** runs.queue */
  queueFollowup(input: RunMessageInput): Promise<unknown>;
  /** runs.retry */
  retry(id: string): Promise<unknown>;
  /** runs.events */
  listEvents(id: string): Promise<unknown>;
  /** spend.get */
  spend(): Promise<unknown>;
  /** repos.list */
  listRepos(): Promise<unknown>;
  /** plugins.list */
  listPlugins(): Promise<unknown>;
}
