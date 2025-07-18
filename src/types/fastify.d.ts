// Minimal Fastify type definitions for the middleware
export interface FastifyRequest {
  method: string;
  url: string;
  ip: string;
  hostname: string;
  query?: any;
  body?: any;
  headers: Record<string, string | string[] | undefined>;
}

export interface FastifyReply {
  statusCode: number;
  header(key: string, value: string): void;
  getHeader(key: string): string | undefined;
}

export interface FastifyInstance {
  addHook(name: string, hook: (request: FastifyRequest, reply: FastifyReply, error?: Error) => Promise<void>): void;
}