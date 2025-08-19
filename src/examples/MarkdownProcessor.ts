import {
  BaseStreamProcessor,
  StreamingContext,
  StreamChunk,
  StreamingUtils
} from '../framework/streaming-interfaces';
import { TextCircularBuffer } from '../framework/CircularStreamBuffer';

/**
 * Markdown processor using circular buffer system
 * Processes markdown with lookahead/lookbehind for complex patterns
 */
export class MarkdownProcessor extends BaseStreamProcessor {
  readonly name = 'markdown';
  readonly priority = 10;
  readonly preferredLookBehind = 128;
  readonly preferredLookAhead = 512;

  canProcess(context: StreamingContext): boolean {
    // Process all text content
    return context.buffer instanceof TextCircularBuffer;
  }

  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const current = buffer.peekChar();
    
    if (!current) return { chunks: [], advance: 0 };

    // Skip whitespace except newlines (they might be significant)
    if (/\s/.test(current) && current !== '\n') {
      return { chunks: [], advance: 1 };
    }

    // Check for headers (need line start)
    if (current === '#' && this.isLineStart(context)) {
      return this.processHeader(context);
    }

    // Check for lists
    if (current === '-' && this.isLineStart(context)) {
      return this.processList(context);
    }

    // Check for bold/italic
    if (current === '*') {
      return this.processEmphasis(context);
    }

    // Check for inline code
    if (current === '`') {
      return this.processInlineCode(context);
    }

    // Check for code blocks
    if (current === '`' && this.isCodeBlock(context)) {
      return this.processCodeBlock(context);
    }

    // Regular text
    return this.processText(context);
  }

  private isLineStart(context: StreamingContext): boolean {
    const buffer = context.buffer as TextCircularBuffer;
    const behind = buffer.lookBehindString(1);
    return behind === '' || behind === '\n';
  }

  private processHeader(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Count header level
    let level = 0;
    let ahead = buffer.lookAheadString(6); // Max 6 #
    
    for (let i = 0; i < ahead.length && ahead[i] === '#'; i++) {
      level++;
    }
    
    // Must have space after #
    if (level === 0 || ahead[level] !== ' ') {
      return this.processText(context);
    }
    
    // Find end of line
    const restOfLine = buffer.lookAheadString(200);
    const newlineIndex = restOfLine.indexOf('\n');
    const headerEnd = newlineIndex >= 0 ? newlineIndex : restOfLine.length;
    
    // Extract header text (skip # and space)
    const headerText = restOfLine.slice(level + 1, headerEnd).trim();
    
    const chunk = this.createChunk('heading', headerText, { level }, context.position);
    
    // Safe advance: at least move past the # character
    const safeAdvance = Math.max(1, level + 1);
    return {
      chunks: [chunk],
      advance: safeAdvance
    };
  }

  private processList(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Check if it's actually a list (- followed by space)
    const ahead = buffer.lookAheadString(2);
    if (ahead[1] !== ' ') {
      return this.processText(context);
    }
    
    // Find end of line
    const restOfLine = buffer.lookAheadString(200);
    const newlineIndex = restOfLine.indexOf('\n');
    const lineEnd = newlineIndex >= 0 ? newlineIndex : restOfLine.length;
    
    // Extract list item text (skip - and space)
    const itemText = restOfLine.slice(2, lineEnd).trim();
    
    const chunk = this.createChunk('listItem', itemText, { type: 'unordered' }, context.position);
    
    return {
      chunks: [chunk],
      advance: 2 + itemText.length + 1 // - + space + text + newline
    };
  }

  private processEmphasis(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Check for bold (**)
    const ahead = buffer.lookAheadString(100);
    if (ahead.startsWith('*')) {
      // This is bold
      const endIndex = ahead.indexOf('**', 2);
      if (endIndex >= 0) {
        const boldText = ahead.slice(2, endIndex);
        const chunk = this.createChunk('strong', boldText, {}, context.position);
        return {
          chunks: [chunk],
          advance: endIndex + 2 // ** + text + **
        };
      }
    }
    
    // Check for italic (single *)
    const endIndex = ahead.indexOf('*', 1);
    if (endIndex >= 0) {
      const italicText = ahead.slice(1, endIndex);
      const chunk = this.createChunk('emphasis', italicText, {}, context.position);
      return {
        chunks: [chunk],
        advance: endIndex + 1 // * + text + *
      };
    }
    
    // Not emphasis, treat as text
    return this.processText(context);
  }

  private processInlineCode(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Find closing backtick
    const ahead = buffer.lookAheadString(100);
    const endIndex = ahead.indexOf('`', 1);
    
    if (endIndex >= 0) {
      const codeText = ahead.slice(1, endIndex);
      const chunk = this.createChunk('code', codeText, { inline: true }, context.position);
      return {
        chunks: [chunk],
        advance: endIndex + 1 // ` + text + `
      };
    }
    
    // Not inline code, treat as text
    return this.processText(context);
  }

  private isCodeBlock(context: StreamingContext): boolean {
    const buffer = context.buffer as TextCircularBuffer;
    const ahead = buffer.lookAheadString(3);
    return ahead === '```';
  }

  private processCodeBlock(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Look for closing ```
    const content = buffer.lookAheadString(1000);
    const closeIndex = content.indexOf('```', 3);
    
    if (closeIndex >= 0) {
      const fullBlock = content.slice(0, closeIndex + 3);
      const lines = fullBlock.split('\n');
      const language = lines[0].slice(3).trim() || 'text';
      const codeContent = lines.slice(1, -1).join('\n');
      
      const chunk = this.createChunk('codeBlock', codeContent, { language }, context.position);
      return {
        chunks: [chunk],
        advance: fullBlock.length
      };
    }
    
    // Incomplete code block, treat as text
    return this.processText(context);
  }

  private processText(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const current = buffer.peekChar() || '';
    
    // Always advance at least 1 to prevent infinite loops
    if (!current) return { chunks: [], advance: 1 };
    
    const chunk = this.createChunk('text', current, {}, context.position);
    return {
      chunks: [chunk],
      advance: 1  // Always advance exactly 1 character for safety
    };
  }

  private isSpecialChar(char: string): boolean {
    return ['#', '*', '`', '-', '\n'].includes(char);
  }
}

/**
 * Simple HTML renderer for markdown chunks
 */
export class HTMLRenderer {
  readonly format = 'html';

  renderChunk(chunk: StreamChunk): string {
    switch (chunk.type) {
      case 'heading':
        const level = chunk.data?.level || 1;
        return `<h${level}>${this.escapeHtml(chunk.content)}</h${level}>\n`;
      
      case 'listItem':
        return `<li>${this.escapeHtml(chunk.content)}</li>\n`;
      
      case 'strong':
        return `<strong>${this.escapeHtml(chunk.content)}</strong>`;
      
      case 'emphasis':
        return `<em>${this.escapeHtml(chunk.content)}</em>`;
      
      case 'code':
        if (chunk.data?.inline) {
          return `<code>${this.escapeHtml(chunk.content)}</code>`;
        } else {
          const language = chunk.data?.language || 'text';
          return `<pre><code class="language-${language}">${this.escapeHtml(chunk.content)}</code></pre>\n`;
        }
      
      case 'codeBlock':
        const lang = chunk.data?.language || 'text';
        return `<pre><code class="language-${lang}">${this.escapeHtml(chunk.content)}</code></pre>\n`;
      
      case 'text':
        return this.escapeHtml(chunk.content);
      
      default:
        return chunk.content;
    }
  }

  renderChunks(chunks: StreamChunk[]): string {
    return chunks.map(chunk => this.renderChunk(chunk)).join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}