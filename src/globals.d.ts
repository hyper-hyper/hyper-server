declare namespace Hyper {
  export type ConfigLike = {};

  export type ServerConfig = {
    root: string,
    host: string,
    port: number,
    ssl: boolean | object,
    cert: object,
    websocket: WebSocketConfig
  }
  export type ListenConfig;

  export type Headers;
  export type StatusCode;
  export interface Message implements Response {
    headers?: Headers | Record<string, string> | Array<[string, string]> | IterableIterator<[string, string]>;
    statusCode?: keyof StatusCode;
    statusMessage?: StatusCode;
  }
  
  export interface Request implements Message {
    method: RequestMothod;

  }

  export interface Response implements Message {

  }

  export interface Server {
    constructor(options: ServerConfig);
    listen(options: ListenConfig, callback: function);
    listen(port: number, handler: function);
    on(method, path, handler: function): Promise<Response>;

  }
}
