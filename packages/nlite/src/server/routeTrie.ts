import { deserialize, serialize } from "node:v8";

interface Route {
  module?: string;
  prerender?: boolean;
  middleWare?: boolean;
  css: string[];
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
    if (segments.length == 0) {
      currentNode.children.set("", {
        segment: "",
        children: new Map(),
        route: route
      });

      return;
    }

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

  print(node?: TrieNode) {
    const currentNode = node || this.root;
    console.log({
      path: currentNode.segment,
      route: JSON.stringify(currentNode.route)
    });
    if (currentNode.children.size) {
      currentNode.children.forEach((childNode) => {
        this.print(childNode);
      });
    }
  }

  match(
    path: string
  ): { match: Route; params: Record<string, string> } | undefined {
    const segments = this.splitPath(path);
    let currentNode = this.root;
    let splat = null;
    const params: Record<string, string> = {};

    if (segments.length == 0) {
      return currentNode.children.has("")
        ? { match: currentNode.children.get("")!.route!, params }
        : undefined;
    }

    for (const segment of segments) {
      let isFound = false;
      const childNoddes = [...currentNode.children.entries()];
      const dynamicSegment = childNoddes.find(([key]) => key.startsWith(":"));
      if (currentNode.children.has(segment)) {
        isFound = true;
        currentNode = currentNode.children.get(segment)!;
      } else if (dynamicSegment) {
        isFound = true;
        currentNode = dynamicSegment[1];
        params[dynamicSegment[0].slice(1)] = segment;
      }
      if (currentNode.children.has("*")) {
        splat = currentNode.children.get("*")!;
      }

      if (!isFound) {
        return splat ? { match: splat.route!, params } : undefined;
      }
    }

    return { match: currentNode.route!, params };
  }

  // TODO: remove this function
  private matchWithParams(path: string): MatchedRoute | undefined {
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

  serializeTrie() {
    return serialize(this.root);
  }

  deSerializeTrie(data: Buffer) {
    return deserialize(data);
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter((segment) => segment.length > 0);
  }
}
