type Task<T> = () => Promise<T>;

export class TaskQueue<T> {
  private queue: Task<T>[] = [];

  // Add a task to the queue
  enqueue(task: Task<T>): void {
    this.queue.push(task);
  }

  // Process the queue using generator and yield
  async *processQueue(): AsyncGenerator<T, void, unknown> {
    while (this.queue.length > 0) {
      const currentTask = this.queue.shift();
      if (currentTask) {
        try {
          const result = await currentTask();
          yield result;
        } catch (error) {
          console.error("Task execution failed:", error);
        }
      }
    }
  }
}

// Create a default instance with unknown type to allow any task type
const taskQueue = new TaskQueue<unknown>();

export default taskQueue;
