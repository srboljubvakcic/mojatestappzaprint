// Client-only shim: server functions just run on the client and receive { data }.
export function useServerFn<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}

export function createServerFn(_opts?: any): any {
  const builder: any = {
    middleware: () => builder,
    inputValidator: () => builder,
    handler: (h: any) => h,
  };
  return builder;
}

export function createMiddleware(): any {
  return { server: (_fn: any) => ({}) };
}

export function createStart(_fn?: any): any {
  return {};
}
