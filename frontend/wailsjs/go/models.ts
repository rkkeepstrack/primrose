export namespace appstate {
	
	export class State {
	    openRoots: string[];
	    activeRoot: string;
	    theme?: string;
	
	    static createFrom(source: any = {}) {
	        return new State(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.openRoots = source["openRoots"];
	        this.activeRoot = source["activeRoot"];
	        this.theme = source["theme"];
	    }
	}

}

export namespace collection {
	
	export class Body {
	    type: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new Body(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	    }
	}
	export class Node {
	    name: string;
	    path: string;
	    isFolder: boolean;
	    method?: string;
	    children?: Node[];
	
	    static createFrom(source: any = {}) {
	        return new Node(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isFolder = source["isFolder"];
	        this.method = source["method"];
	        this.children = this.convertValues(source["children"], Node);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Collection {
	    name: string;
	    root: string;
	    tree: Node[];
	
	    static createFrom(source: any = {}) {
	        return new Collection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.root = source["root"];
	        this.tree = this.convertValues(source["tree"], Node);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Request {
	    method: string;
	    url: string;
	    query: Record<string, string>;
	    headers: Record<string, string>;
	    body: Body;
	    vars: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Request(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.url = source["url"];
	        this.query = source["query"];
	        this.headers = source["headers"];
	        this.body = this.convertValues(source["body"], Body);
	        this.vars = source["vars"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace cookies {
	
	export class Cookie {
	    domain: string;
	    path: string;
	    name: string;
	    value: string;
	    expires: string;
	    secure: boolean;
	    httpOnly: boolean;
	    hostOnly: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Cookie(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.domain = source["domain"];
	        this.path = source["path"];
	        this.name = source["name"];
	        this.value = source["value"];
	        this.expires = source["expires"];
	        this.secure = source["secure"];
	        this.httpOnly = source["httpOnly"];
	        this.hostOnly = source["hostOnly"];
	    }
	}

}

export namespace env {
	
	export class Environment {
	    name: string;
	    path: string;
	    vars: Record<string, string>;
	    headers: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new Environment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.vars = source["vars"];
	        this.headers = source["headers"];
	    }
	}

}

export namespace httpclient {
	
	export class Response {
	    requestUrl: string;
	    finalUrl: string;
	    redirects?: string[];
	    requestHeaders: Record<string, string>;
	    status: number;
	    statusText: string;
	    headers: Record<string, string>;
	    body: string;
	    bodyBase64?: string;
	    contentType: string;
	    durationMs: number;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Response(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestUrl = source["requestUrl"];
	        this.finalUrl = source["finalUrl"];
	        this.redirects = source["redirects"];
	        this.requestHeaders = source["requestHeaders"];
	        this.status = source["status"];
	        this.statusText = source["statusText"];
	        this.headers = source["headers"];
	        this.body = source["body"];
	        this.bodyBase64 = source["bodyBase64"];
	        this.contentType = source["contentType"];
	        this.durationMs = source["durationMs"];
	        this.size = source["size"];
	    }
	}

}

