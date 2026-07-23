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
