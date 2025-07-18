// Minimal Express type definitions for the middleware
export interface Request {
  method: string;
  url: string;
  path: string;
  ip?: string;
  query: any;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
  socket: {
    remoteAddress?: string;
  };
}

export interface Response {
  statusCode: number;
  send(data: any): Response;
  json(data: any): Response;
  on(event: string, listener: (...args: any[]) => void): void;
  get(field: string): string | undefined;
}

export type NextFunction = (err?: any) => void;