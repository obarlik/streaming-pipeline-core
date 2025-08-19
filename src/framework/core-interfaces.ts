/**
 * Core interfaces for AST-first streaming pipeline
 * No backward compatibility - clean, modern design
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

export interface ProcessingContext {
  readonly position?: number;
  readonly contentType?: string;
  readonly metadata?: Record<string, any>;
  readonly variables?: Map<string, any>;
}

// Core processor interface - AST-first
export interface IProcessor<TInput = string, TData = any> {
  readonly name: string;
  readonly priority: number;
  
  canProcess(content: TInput, context: ProcessingContext): boolean;
  parseToAST(content: TInput, context: ProcessingContext): ParseResult<TData>;
}

// Core renderer interface - AST-first  
export interface IRenderer<TData = any, TOutput = string> {
  readonly format: string;
  renderFromAST(ast: ASTNode<TData>): TOutput;
}

// Pipeline orchestrator interface
export interface IPipelineOrchestrator<TInput = string, TOutput = string> {
  // Parse-only operation
  parseToAST(content: TInput, context?: ProcessingContext): Promise<ParseResult>;
  
  // Render-only operation
  renderFromAST(ast: ASTNode, format: string): Promise<TOutput>;
  
  // Complete pipeline
  process(content: TInput, format: string, context?: ProcessingContext): Promise<TOutput>;
}

// AST visitor pattern for traversal
export interface ASTVisitor<TData = any, TResult = void> {
  visitNode(node: ASTNode<TData>, parent?: ASTNode<TData>): TResult;
  visitChildren?(node: ASTNode<TData>): TResult[];
}

// AST transformer for modifications
export interface ASTTransformer<TData = any> {
  transform(node: ASTNode<TData>): ASTNode<TData>;
  canTransform(node: ASTNode<TData>): boolean;
}