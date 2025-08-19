/**
 * Generic streaming pipeline interfaces
 */

export interface ContentSegment<TData = any> {
  readonly type: string;
  readonly content: string;
  readonly data?: TData;
  readonly children?: ContentSegment<TData>[];
}

export interface ProcessingContext {
  readonly position?: number;
  readonly contentType?: string;
  readonly metadata?: Record<string, any>;
  readonly variables?: Map<string, any>;
}

export interface IContentProcessor<TInput = string, TOutput = ContentSegment> {
  readonly name: string;
  readonly priority: number;
  
  canProcess(content: TInput, context: ProcessingContext): boolean;
  process(content: TInput, context: ProcessingContext): TOutput[];
}

export interface IContentRenderer<TInput = ContentSegment, TOutput = string> {
  readonly format: string;
  
  render(segments: TInput[]): TOutput;
}

export interface IPipelineOrchestrator<TInput = string, TOutput = string> {
  process(content: TInput, contentType?: string): ContentSegment[];
  render(segments: ContentSegment[], format: string): TOutput;
}