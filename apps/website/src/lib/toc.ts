import type { InlineCode, Link, List, ListItem, Paragraph, Root, Text } from "mdast";
import { toc } from "mdast-util-toc";
import { remark } from "remark";
import type { Node } from "unist";
import { visit } from "unist-util-visit";

const textTypes = ["text", "emphasis", "strong", "inlineCode"] as const;

function flattenNode(node: Node): string {
  const p: string[] = [];
  visit(node, (visitedNode: Node) => {
    if (!textTypes.includes(visitedNode.type as any)) return;
    const textNode = visitedNode as Text | InlineCode;
    if ("value" in textNode) {
      p.push(textNode.value);
    }
  });

  return p.join(``);
}

interface Item {
  title: string;
  url: string;
  items?: Item[];
}

interface Items {
  items?: Item[];
}

function getItems(node: Node | null | undefined, current: Partial<Item>): Items {
  if (!node) {
    return {};
  }

  if (node.type === "paragraph") {
    const paragraphNode = node as Paragraph;
    visit(paragraphNode, (item: Node) => {
      if (item.type === "link") {
        const linkNode = item as Link;
        current.url = linkNode.url;
        current.title = flattenNode(paragraphNode);
      }

      if (item.type === "text") {
        current.title = flattenNode(paragraphNode);
      }
    });

    return current as Items;
  }

  if (node.type === "list") {
    const listNode = node as List;
    current.items = listNode.children.map((i) => getItems(i, {}) as Item).filter(Boolean);

    return current as Items;
  }
  if (node.type === "listItem") {
    const listItemNode = node as ListItem;
    const heading = getItems(listItemNode.children[0], {});

    if (listItemNode.children.length > 1) {
      getItems(listItemNode.children[1], heading as Partial<Item>);
    }

    return heading;
  }

  return {};
}

const getToc = () => (node: Root, file: any) => {
  const table = toc(node);
  file.data = getItems(table.map, {});
};

export type TableOfContents = Items;

export async function getTableOfContents(content: string): Promise<TableOfContents> {
  const result = await remark().use(getToc).process(content);

  return (result.data as TableOfContents) || {};
}
