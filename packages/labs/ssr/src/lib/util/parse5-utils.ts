/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * TODO(usergenic): The following set of helper functions are more-or-less
 * copied from the npm package dom5 which could not be brought in at this
 * time because it is bound to `parse5@4` where this package uses `parse5@5`.
 * Once dom5 is updated, we can just use that package and not maintain these
 * here.
 */

// types only
import {Node, Element, CommentNode, DocumentFragment, ParentNode} from 'parse5';
import * as parse5lib from 'parse5';

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const parse5 = require('parse5') as typeof parse5lib;

export const parseFragment = parse5.parseFragment;

export function filter(iter: any, predicate: any, matches: any[] = []) {
  for (const value of iter) {
    if (predicate(value)) {
      matches.push(value);
    }
  }
  return matches;
}

export function getAttr(ast: Node, name: string) {
  if (ast.hasOwnProperty('attrs')) {
    const attr = (<{name: string; value: any}[]>(<Element>ast).attrs).find(
      ({name: attrName}) => attrName === name
    );
    if (attr) {
      return attr.value;
    }
  }
}

export function getTextContent(node: any): string {
  if (isCommentNode(node)) {
    return node.data || '';
  }
  if (isTextNode(node)) {
    return node.value || '';
  }
  const subtree = nodeWalkAll(node, isTextNode);
  return subtree.map(getTextContent).join('');
}

export function setAttr(ast: any, name: any, value: any) {
  const attr = (<{name: string; value: any}[]>ast.attrs).find(
    ({name: attrName}) => attrName === name
  );
  if (attr) {
    attr.value = value;
  } else {
    ast.attrs.push({name, value});
  }
}

export function insertBefore(parent: any, oldNode: any, newNode: any) {
  const index = parent.childNodes.indexOf(oldNode);
  insertNode(parent, index, newNode);
}

export function insertNode(
  parent: any,
  index: any,
  newNode: any,
  replace: any = undefined
) {
  if (!parent.childNodes) {
    parent.childNodes = [];
  }
  let newNodes: any[] = [];
  let removedNode = replace ? parent.childNodes[index] : null;
  if (newNode) {
    if (isDocumentFragment(newNode)) {
      if (newNode.childNodes) {
        newNodes = Array.from(newNode.childNodes);
        newNode.childNodes.length = 0;
      }
    } else {
      newNodes = [newNode];
      removeNode(newNode);
    }
  }
  if (replace) {
    removedNode = parent.childNodes[index];
  }
  Array.prototype.splice.apply(
    <any[]>parent.childNodes,
    (<any>[index, replace ? 1 : 0]).concat(newNodes)
  );
  newNodes.forEach((n) => {
    n.parentNode = parent;
  });

  if (removedNode) {
    removedNode.parentNode = undefined;
  }
}

export function isElement(node: Node): node is Element {
  return (node as Element).tagName !== undefined;
}

export function isCommentNode(node: Node): node is CommentNode {
  return node.nodeName === '#comment';
}

export function isDocumentFragment(node: Node): node is DocumentFragment {
  return node.nodeName === '#document-fragment';
}

export function isTextNode(node: Node): node is parse5lib.TextNode {
  return node.nodeName === '#text';
}

export type GetChildNodes = (node: ParentNode) => Array<Node> | undefined;
export const defaultChildNodes: GetChildNodes = (node: ParentNode) =>
  node.childNodes;

export function* depthFirst(
  node: Node | DocumentFragment,
  getChildNodes: GetChildNodes = defaultChildNodes
): Iterable<Node> {
  yield node;
  const childNodes = getChildNodes(node as ParentNode);
  if (childNodes === undefined) {
    return;
  }
  for (const child of childNodes) {
    yield* depthFirst(child, getChildNodes);
  }
}

export function nodeWalkAll(
  node: any,
  predicate: any,
  matches: any = [],
  getChildNodes: any = defaultChildNodes
) {
  return filter(depthFirst(node, getChildNodes), predicate, matches);
}

export function removeFakeRootElements(node: any) {
  const fakeRootElements: any[] = [];
  traverse(node, {
    pre: (node: any) => {
      if (
        node.nodeName &&
        node.nodeName.match(/^(html|head|body)$/i) &&
        !node.sourceCodeLocation
      ) {
        fakeRootElements.unshift(node);
      }
    },
  });
  fakeRootElements.forEach(removeNodeSaveChildren);
}

export function removeNode(node: any) {
  const parent = node.parentNode;
  if (parent && parent.childNodes) {
    const idx = parent.childNodes.indexOf(node);
    parent.childNodes.splice(idx, 1);
  }
  node.parentNode = undefined;
}

export function removeNodeSaveChildren(node: any) {
  // We can't save the children if there's no parent node to provide
  // for them.
  const fosterParent = node.parentNode;
  if (!fosterParent) {
    return;
  }
  const children = (node.childNodes || []).slice();
  for (const child of children) {
    insertBefore(node.parentNode, node, child);
  }
  removeNode(node);
}

export function setTextContent(node: any, value: any) {
  if (isCommentNode(node)) {
    node.data = value;
  } else if (isTextNode(node)) {
    node.value = value;
  } else {
    const tn = newTextNode(value);
    tn.parentNode = node;
    node.childNodes = [tn];
  }
}

export function newTextNode(value: any) {
  return {
    nodeName: '#text',
    value: value,
    parentNode: undefined,
    attrs: [],
    __location: undefined,
  };
}

export interface Visitor {
  pre?: (node: Node, parent?: ParentNode) => boolean | void;
  post?: (node: Node, parent?: ParentNode) => boolean | void;
  getChildNodes?: GetChildNodes;
}

export const traverse = (node: Node, visitor: Visitor, parent?: ParentNode) => {
  const getChildNodes: GetChildNodes =
    visitor.getChildNodes ?? defaultChildNodes;
  let visitChildren: boolean | void = true;

  if (typeof visitor.pre === 'function') {
    visitChildren = visitor.pre(node, parent);
  }

  if (visitChildren !== false) {
    const childNodes = getChildNodes(node as ParentNode);
    if (childNodes !== undefined) {
      for (const child of childNodes) {
        traverse(child, visitor, node as ParentNode);
      }
    }
  }

  if (typeof visitor.post === 'function') {
    visitor.post(node, parent);
  }
};
