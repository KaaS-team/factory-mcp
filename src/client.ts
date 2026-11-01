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

export interface FactoryClient {
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  createTask(input: CreateTaskInput): Promise<Task>;
  handOffTask(input: HandOffInput): Promise<Task>;
}
