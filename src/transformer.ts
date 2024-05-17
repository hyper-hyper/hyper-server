import * as ts from "typescript";
import * as utils from "./utils";

/**
 * Custom TypeScript Transformer class, used to transform JSX to String.
 */

export class Transformer {
  private typeChecker: ts.TypeChecker | undefined;

  /**
   * Constructor
   *
   * @param program
   * @param context
   */
  constructor(
    program: ts.Program | undefined,
    private context: ts.TransformationContext
  ) {
    this.typeChecker = program && program.getTypeChecker();
  }

  /**
   * Transform self-closing JSX element to String
   *
   * @param node
   * @param result
   */
  getStringFromClosingElement(
    node: ts.JsxClosingElement,
    result: utils.StringTemplateHelper
  ) {
    result.add(`</${node.tagName.getText()}>`);
  }

  /**
   * Transform JSX spread attribute to String
   *
   * @param node
   * @param result
   */
  getStringFromJsxSpreadAttribute(
    node: ts.JsxSpreadAttribute,
    result: utils.StringTemplateHelper
  ) {
    result.add(
      " ",
      new utils.Identifier("Object")
        .access("entries")
        .call(node.expression)
        .access("map")
        .call(
          new utils.ArrowFunction(
            [["key", "value"]],
            new utils.StringTemplateHelper(
              ts.createIdentifier("key"),
              '="',
              ts.createIdentifier("value"),
              '"'
            ).getNode()
          ).getNode()
        )
        .access("join")
        .call(ts.createLiteral(" "))
        .getNode()
    );
  }

  /**
   * Transform JSX attribute to String
   *
   * @param node
   * @param result
   */
  getStringFromAttribute(
    node: ts.JsxAttribute,
    result: utils.StringTemplateHelper
  ) {
    if (node.initializer &&
      node.initializer.kind === ts.SyntaxKind.JsxExpression) {
      result.add(
        ` ${node.name.getText()}="`,
        node.initializer.expression!,
        `"`
      );
    } else {
      result.add(" " + node.getText());
    }
  }

  /**
   * Transorm JSX (spread) attributes to String
   *
   * @param node
   * @param result
   */
  getStringFromAttributes(
    node: ts.JsxAttributes,
    result: utils.StringTemplateHelper
  ) {
    for (const property of node.properties) {
      if (property.kind === ts.SyntaxKind.JsxSpreadAttribute) {
        this.getStringFromJsxSpreadAttribute(property, result);
      } else {
        this.getStringFromAttribute(property, result);
      }
    }
  }

  /**
   * Transform JSX opening element to String
   *
   * @param node
   * @param result
   */
  getStringFromOpeningElement(
    node: ts.JsxOpeningElement,
    result: utils.StringTemplateHelper
  ) {
    result.add(`<${node.tagName.getText()}`);
    this.getStringFromAttributes(node.attributes, result);
    result.add(">");
  }

  /**
   * Convert JSX Element attributes to JavaScript Object
   *
   * @param property
   * @returns
   */
  getObjectLiteralElementFromAttribute(
    property: ts.JsxAttributeLike
  ): ts.ObjectLiteralElementLike {
    if (property.kind === ts.SyntaxKind.JsxSpreadAttribute) {
      return ts.createSpreadAssignment(property.expression);
    }
    const name = property.name.getText();
    const value = property.initializer
      ? property.initializer.kind === ts.SyntaxKind.JsxExpression
        ? property.initializer.expression!
        : ts.createLiteral(property.initializer.text)
      : ts.createLiteral(true);
    return ts.createPropertyAssignment(name, value);
  }

  /**
   * Transform JSX (Functional) Component to string
   *
   * @param node
   * @param result
   */
  getStringFromJsxElementComponent(
    node: ts.JsxElement,
    result: utils.StringTemplateHelper
  ) {
    const parameters = node.openingElement.attributes.properties.map(
      this.getObjectLiteralElementFromAttribute.bind(this)
    );
    const childrenResult = new utils.StringTemplateHelper();
    for (const child of node.children) {
      this.getStringFromJsxChild(child, childrenResult);
    }
    const childrenParameter = ts.createPropertyAssignment(
      "children",
      childrenResult.getNode()
    );
    parameters.push(childrenParameter);
    result.add(
      ts.createCall(
        node.openingElement.tagName,
        [],
        [ts.createObjectLiteral(parameters)]
      )
    );
  }

  /**
   * Transform JSX Element to string
   *
   * @param node
   * @param result
   * @returns
   */
  getStringFromJsxElement(
    node: ts.JsxElement,
    result: utils.StringTemplateHelper
  ) {
    if (node.openingElement.tagName.getText().match(/[A-Z]/)) {
      this.getStringFromJsxElementComponent(node, result);
      return;
    }
    this.getStringFromOpeningElement(node.openingElement, result);
    for (const child of node.children) {
      this.getStringFromJsxChild(child, result);
    }
    this.getStringFromClosingElement(node.closingElement, result);
  }

  /**
   * Transform JSX Fragment to string
   *
   * @param node
   * @param result
   */
  getStringFromJsxFragment(
    node: ts.JsxFragment,
    result: utils.StringTemplateHelper
  ) {
    for (const child of node.children) {
      this.getStringFromJsxChild(child, result);
    }
  }

  /**
   * Transform JSX Void Component to string
   *
   * @param node
   * @param result
   */
  getStringFromJsxSelfClosingElementComponent(
    node: ts.JsxSelfClosingElement,
    result: utils.StringTemplateHelper
  ) {
    let parameters: ts.ObjectLiteralElementLike[] = [];
    parameters.push(
      ts.createPropertyAssignment("children", ts.createLiteral(""))
    );
    parameters = parameters.concat(
      node.attributes.properties.map((property) => this.getObjectLiteralElementFromAttribute(property)
      )
    );
    result.add(
      ts.createCall(node.tagName, [], [ts.createObjectLiteral(parameters)])
    );
  }

  /**
   * Transform JSX Self-Closing Element to string
   *
   * @param node
   * @param result
   * @returns
   */
  getStringFromJsxSelfClosingElement(
    node: ts.JsxSelfClosingElement,
    result: utils.StringTemplateHelper
  ) {
    if (node.tagName.getText().match(/[A-Z]/)) {
      this.getStringFromJsxSelfClosingElementComponent(node, result);
      return;
    }
    result.add("<", node.tagName.getText());
    this.getStringFromAttributes(node.attributes, result);
    result.add("/>");
  }

  /**
   * Transform JSX expression to string
   *
   * @param node
   * @param result
   */
  getStringFromJsxExpression(
    node: ts.JsxExpression,
    result: utils.StringTemplateHelper
  ) {
    const newNode = ts.visitNode(node.expression!, this.visit.bind(this));
    if (this.typeChecker) {
      const type = this.typeChecker.getTypeAtLocation(newNode);
      const symbol = type.getSymbol();
      if (symbol && symbol.getName() === "Array") {
        result.add(
          ts.createCall(
            ts.createPropertyAccess(newNode, "join"),
            [],
            [ts.createLiteral("")]
          )
        );
      } else {
        result.add(newNode);
      }
    } else {
      result.add(newNode);
    }
  }

  /**
   * Transform JSX Child Node to string
   *
   * @param node
   * @param result
   * @returns
   */
  getStringFromJsxChild(node: ts.JsxChild, result: utils.StringTemplateHelper) {
    switch (node.kind) {
      case ts.SyntaxKind.JsxElement:
        this.getStringFromJsxElement(node, result);
        break;
      case ts.SyntaxKind.JsxFragment:
        this.getStringFromJsxFragment(node, result);
        break;
      case ts.SyntaxKind.JsxSelfClosingElement:
        this.getStringFromJsxSelfClosingElement(node, result);
        break;
      case ts.SyntaxKind.JsxText:
        const text = node
          .getFullText()
          .replace(/^\n* */g, "")
          .replace(/\n* *$/g, "")
          .replace(/\n+ */g, " ");
        result.add(text);
        break;
      case ts.SyntaxKind.JsxExpression:
        this.getStringFromJsxExpression(node, result);
        break;
      default:
        throw new Error("NOT IMPLEMENTED"); // TODO improve error message
    }
    return result;
  }

  /**
   * Transformer's essential method
   *
   * @param node
   * @returns
   */
  visit(node: ts.Node): ts.Node {
    const {
      JsxElement, JsxFragment, JsxSelfClosingElement
    } = ts.SyntaxKind;
    if ([
      JsxElement,
      JsxFragment,
      JsxSelfClosingElement
    ].indexOf(node.kind) !== -1) {
      const result = new utils.StringTemplateHelper();
      this.getStringFromJsxChild(node as ts.JsxChild, result);
      return result.getNode();
    }
    return ts.visitEachChild(node, this.visit.bind(this), this.context);
  }

  /**
   * Transformers starting point
   *
   * @param rootNode
   * @returns
   */
  transform<T extends ts.Node>(rootNode: T): T {
    return ts.visitNode(rootNode, this.visit.bind(this));
  }
}
import * as ts from "typescript";

import * as ts from "typescript";
import { JsxElement } from "./jsx";
import { Transformer } from "./Transformer.ts";

export class Node<T extends ts.Node> {
  constructor(private node?: T) {}
  getNode(): T {
    if (this.node === undefined) {
      throw new Error("Node has not been set");
    }
    return this.node;
  }
}

export class Expression<T extends ts.Expression> extends Node<T> {
  call(...args: ts.Expression[]) {
    return new Expression(ts.createCall(this.getNode(), [], args));
  }
  access(name: string | ts.Identifier) {
    return new Expression(ts.createPropertyAccess(this.getNode(), name));
  }
}

export class Identifier extends Expression<ts.Identifier> {
  constructor(name: string) {
    super(ts.createIdentifier(name));
  }
}

export class ArrowFunction extends Expression<ts.ArrowFunction> {
  protected parameters: ts.ParameterDeclaration[] = [];
  protected body: ts.Expression | null = null;
  constructor(
    parameters: (ts.ParameterDeclaration | string[])[] = [],
    body: ts.Expression | null = null
  ) {
    super();
    this.addParameter(...parameters);
    if (body) this.setBody(body);
  }
  addParameter(...parameters: (ts.ParameterDeclaration | string[])[]) {
    this.parameters = this.parameters.concat(
      parameters.map(p => {
        if (Array.isArray(p)) {
          return createParameter(
            ts.createArrayBindingPattern(p.map(createBindingElement))
          );
        }
        return p;
      })
    );
    return this;
  }
  setBody(body: ts.Expression) {
    this.body = body;
    return this;
  }
  getNode() {
    if (this.body === null) {
      throw new Error(
        "Cannot create arrow function because body hasn't been set"
      );
    }
    return ts.createArrowFunction(
      undefined,
      undefined,
      this.parameters,
      undefined,
      undefined,
      this.body
    );
  }
}

export class StringTemplateHelper extends Expression<
  ts.TemplateExpression | ts.StringLiteral | ts.Expression
> {
  private body: [ts.Expression, string][] = [[null as any, ""]];
  constructor(...els: (ts.Expression | string)[]) {
    super();
    this.add(...els);
  }
  public add(...elements: (ts.Expression | string)[]) {
    for (const element of elements) {
      if (typeof element === "string") {
        this.body[this.body.length - 1][1] += element;
      } else {
        this.body.push([element, ""]);
      }
    }
  }
  getNode() {
    if (this.body.length === 1) return ts.createLiteral(this.body[0][1]);
    if (
      this.body.length === 2 &&
      this.body[0][1] === "" &&
      this.body[1][1] === ""
    ) {
      return this.body[1][0];
    }
    const head = ts.createTemplateHead(this.body[0][1]);
    const body = this.body.slice(1).map(([node, lit], index, arr) => {
      return ts.createTemplateSpan(
        node,
        index === arr.length - 1
          ? ts.createTemplateTail(lit)
          : ts.createTemplateMiddle(lit)
      );
    });
    return ts.createTemplateExpression(head, body);
  }
}

export function createParameter(name: string | ts.ArrayBindingPattern) {
  return ts.createParameter(undefined, undefined, undefined, name);
}

export function createBindingElement(name: string): ts.BindingElement {
  return ts.createBindingElement(undefined, undefined, name, undefined);
}

/**
 * Init the Transformer
 * 
 * @param program 
 */
function transformer<T extends ts.Node>(program: ts.Program): ts.TransformerFactory<T>;
function transformer<T extends ts.Node>(context: ts.TransformationContext): ts.Transformer<T>;
function transformer<T extends ts.Node>(programOrContext: ts.Program | ts.TransformationContext) {
  if (isProgram(programOrContext)) {
    return (context: ts.TransformationContext) => (node: T) =>
      new Transformer(programOrContext, context).transform(node);
  }
  return (node: T) =>
    new Transformer(undefined, programOrContext).transform(node);
}

/**
 * Check if it is a TypeScript Program
 * 
 * @param t 
 * @returns 
 */
function isProgram(t: object): t is ts.Program {
  return "getTypeChecker" in t;
}

export default transformer;