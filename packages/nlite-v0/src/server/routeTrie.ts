import { deserialize, serialize } from "node:v8";

export interface Route {
  module?: string;
  rendering?: "default" | "ssr" | "ssg";
  incremental?: string;
  rsc?: string;
  shell?: string;
  css: string[];
}

interface TrieNode {
  segment: string;
  children: Map<string, TrieNode>;
  route?: Route;
}

export default class RouteTrie {
  private root: TrieNode;

  constructor(root?: TrieNode) {
    this.root = root || { segment: "", children: new Map(), route: undefined };
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

  serializeTrie() {
    return serialize(this.root);
  }

  public static deSerializeTrie(data: Buffer) {
    const parsed = deserialize(data);
    return new RouteTrie(parsed);
  }

  private splitPath(path: string): string[] {
    return path.split("/").filter((segment) => segment.length > 0);
  }
}
