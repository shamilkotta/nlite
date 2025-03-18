interface Route {
  module?: string;
  layout?: string;
  error?: string;
  loading?: string;
  prerender?: boolean;
  middleWare?: any[];
  output: {
    module?: string;
    layout?: string;
    error?: string;
    loading?: string;
  };
}

interface TrieNode {
  segment: string;
  children: Map<string, TrieNode>;
  route?: Route;
}

interface MatchedRoute {
  route: Route;
  params: Record<string, string>;
}

export default class RouteTrie {
  private root: TrieNode;

  constructor() {
    this.root = { segment: "", children: new Map(), route: undefined };
  }

  insert(path: string, route: Route) {
    const segments = this.splitPath(path);
    let currentNode = this.root;

    for (const segment of segments) {
      if (!currentNode.children.has(segment)) {
        currentNode.children.set(segment, {
          segment,
          children: new Map(),
          route: undefined
        });
      }
      currentNode = currentNode.children.get(segment)!;
    }

    currentNode.route = route;
  }

  match(path: string): Route | undefined {
    const segments = this.splitPath(path);
    let currentNode = this.root;

    for (const segment of segments) {
      if (currentNode.children.has(segment)) {
        currentNode = currentNode.children.get(segment)!;
      } else if (currentNode.children.has(":")) {
        currentNode = currentNode.children.get(":")!;
      } else {
        return undefined;
      }
    }

    return currentNode.route;
  }

  matchWithParams(path: string): MatchedRoute | undefined {
    const segments = this.splitPath(path);
    let currentNode = this.root;
    const params: Record<string, string> = {};

    for (const segment of segments) {
      if (currentNode.children.has(segment)) {
        currentNode = currentNode.children.get(segment)!;
      } else if (currentNode.children.has(":")) {
        const dynamicSegment = currentNode.children.get(":")!;
        params[dynamicSegment.segment.slice(1)] = segment;
        currentNode = dynamicSegment;
      } else {
        return undefined;
      }
    }

    if (currentNode.route) {
      return { route: currentNode.route, params };
    }

    return undefined;
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter((segment) => segment.length > 0);
  }
}
