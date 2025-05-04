declare interface DedicatedWorkerGlobalScope extends WorkerGlobalScope {
  onmessage: (event: MessageEvent) => void;
  postMessage: (message: any, transfer?: Transferable[]) => void;
}
