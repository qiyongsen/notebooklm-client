declare interface Window {
  WIZ_global_data?: {
    SNlM0e?: string;
    cfb2h?: string;
    FdrFJe?: string;
  };
}

// Optional dependency — may not be installed
declare module 'tlsclientwrapper' {
  export class ModuleClient {
    constructor(opts: { maxThreads?: number });
    terminate(): Promise<void>;
  }
  export class SessionClient {
    constructor(module: ModuleClient, opts: Record<string, unknown>);
    post(url: string, body: string, opts?: Record<string, unknown>): Promise<{ status: number; body: string; headers: Record<string, string[]> }>;
    get(url: string, opts?: Record<string, unknown>): Promise<{ status: number; body: string; headers: Record<string, string[]> }>;
    destroySession(): Promise<void>;
  }
}
