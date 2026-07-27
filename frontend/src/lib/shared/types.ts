export interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  method?: string;
  children?: TreeNode[];
}

export interface Collection {
  name: string;
  root: string;
  tree: TreeNode[];
}

export interface RequestBody {
  type: 'json' | 'text';
  content: string;
}

export interface ApiRequest {
  method: string;
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: RequestBody;
}

export interface ApiResponse {
  finalUrl: string;
  requestHeaders: Record<string, string>;
  bodyBase64?: string;
  contentType: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  size: number;
}

export interface RunRecord {
  at: Date;
  response: ApiResponse | null;
  error: string | null;
}

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

// compact labels for tight spots like the sidebar tree
const METHOD_ABBREV: Record<string, string> = {
  PATCH: 'PAT',
  DELETE: 'DEL',
  OPTIONS: 'OPT',
};

export function abbrevMethod(method: string | undefined): string {
  return METHOD_ABBREV[method ?? ''] ?? method ?? '';
}

export interface Environment {
  name: string;
  path: string;
  vars: Record<string, string>;
  headers: Record<string, string>;
}
