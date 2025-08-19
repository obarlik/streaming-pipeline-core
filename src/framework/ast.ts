/**
 * Abstract Syntax Tree (AST) support for streaming pipeline
 * Enables parse-only and render-from-AST operations
 */

export interface ASTNode<TData = any> {
  readonly type: string;
  readonly content: string;
  readonly data?: TData;
  readonly children?: ASTNode<TData>[];
  readonly position?: ASTPosition;
  readonly metadata?: Record<string, any>;
}

export interface ASTPosition {
  readonly start: number;
  readonly end: number;
  readonly line?: number;
  readonly column?: number;
}

export interface ParseResult<TData = any> {
  readonly ast: ASTNode<TData>;
  readonly errors: ParseError[];
  readonly metadata: ParseMetadata;
}

export interface ParseError {
  readonly message: string;
  readonly position?: ASTPosition;
  readonly severity: 'error' | 'warning' | 'info';
  readonly code?: string;
}

export interface ParseMetadata {
  readonly parseTime: number;
  readonly nodeCount: number;
  readonly originalLength: number;
  readonly parserVersion: string;
}

// AST Visitor Pattern for traversal
export interface ASTVisitor<TData = any, TResult = void> {
  visitNode(node: ASTNode<TData>, parent?: ASTNode<TData>): TResult;
  visitChildren?(node: ASTNode<TData>): TResult[];
}

// AST Transformer for modifications
export interface ASTTransformer<TData = any> {
  transform(node: ASTNode<TData>): ASTNode<TData>;
  canTransform(node: ASTNode<TData>): boolean;
}

// Enhanced processor interface with AST support
export interface IASTProcessor<TInput = string, TData = any> {
  readonly name: string;
  readonly priority: number;
  
  canProcess(content: TInput, context: ProcessingContext): boolean;
  
  // Parse to AST only
  parseToAST(content: TInput, context: ProcessingContext): ParseResult<TData>;
  
  // Legacy segment processing (for backward compatibility)
  process?(content: TInput, context: ProcessingContext): ContentSegment[];
}

// Enhanced renderer interface with AST support  
export interface IASTRenderer<TData = any, TOutput = string> {
  readonly format: string;
  
  // Render from AST
  renderFromAST(ast: ASTNode<TData>): TOutput;
  
  // Legacy segment rendering (for backward compatibility)
  render?(segments: ContentSegment[]): TOutput;
}

// AST utilities
export class ASTUtils {
  /**
   * Convert ContentSegment array to AST
   */
  static segmentsToAST(segments: ContentSegment[]): ASTNode {
    return {
      type: 'document',
      content: '',
      children: segments.map(segment => ({
        type: segment.type,
        content: segment.content,
        data: segment.data,
        children: segment.children?.map((child: ContentSegment) => ({
          type: child.type,
          content: child.content,
          data: child.data
        }))
      }))
    };
  }

  /**
   * Convert AST to ContentSegment array
   */
  static astToSegments(ast: ASTNode): ContentSegment[] {
    if (!ast.children) {
      return [{
        type: ast.type,
        content: ast.content,
        data: ast.data
      }];
    }

    return ast.children.map(child => ({
      type: child.type,
      content: child.content,
      data: child.data,
      children: child.children?.map(grandchild => ({
        type: grandchild.type,
        content: grandchild.content,
        data: grandchild.data
      }))
    }));
  }

  /**
   * Walk AST with visitor pattern
   */
  static walkAST<TData, TResult>(
    ast: ASTNode<TData>, 
    visitor: ASTVisitor<TData, TResult>,
    parent?: ASTNode<TData>
  ): TResult[] {
    const results: TResult[] = [];
    
    const result = visitor.visitNode(ast, parent);
    if (result !== undefined) {
      results.push(result);
    }

    if (ast.children && visitor.visitChildren) {
      const childResults = visitor.visitChildren(ast);
      results.push(...childResults);
    } else if (ast.children) {
      for (const child of ast.children) {
        results.push(...this.walkAST(child, visitor, ast));
      }
    }

    return results;
  }

  /**
   * Transform AST with transformer pattern
   */
  static transformAST<TData>(
    ast: ASTNode<TData>, 
    transformer: ASTTransformer<TData>
  ): ASTNode<TData> {
    let transformedNode = transformer.canTransform(ast) 
      ? transformer.transform(ast) 
      : ast;

    if (transformedNode.children) {
      transformedNode = {
        ...transformedNode,
        children: transformedNode.children.map(child => 
          this.transformAST(child, transformer)
        )
      };
    }

    return transformedNode;
  }

  /**
   * Find nodes by type
   */
  static findNodesByType<TData>(ast: ASTNode<TData>, type: string): ASTNode<TData>[] {
    const results: ASTNode<TData>[] = [];
    
    if (ast.type === type) {
      results.push(ast);
    }

    if (ast.children) {
      for (const child of ast.children) {
        results.push(...this.findNodesByType(child, type));
      }
    }

    return results;
  }

  /**
   * Calculate AST statistics
   */
  static getASTStats<TData>(ast: ASTNode<TData>): {
    nodeCount: number;
    maxDepth: number;
    typeDistribution: Record<string, number>;
  } {
    let nodeCount = 0;
    let maxDepth = 0;
    const typeDistribution: Record<string, number> = {};

    function traverse(node: ASTNode<TData>, depth: number) {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);
      typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;

      if (node.children) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    }

    traverse(ast, 0);

    return { nodeCount, maxDepth, typeDistribution };
  }
}

// Re-export for convenience
import { ContentSegment, ProcessingContext } from './interfaces';
export { ContentSegment, ProcessingContext };