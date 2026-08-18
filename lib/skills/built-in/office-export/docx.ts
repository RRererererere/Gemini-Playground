/**
 * Office Export Skill — DOCX Converter
 * 
 * Конвертирует HTML в Word документ через docx (browser-compatible)
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { ExportJob } from './types';

interface ParsedNode {
  tag: string;
  text: string;
  children?: ParsedNode[];
}

/**
 * Простой парсер HTML в структуру для docx
 */
function parseSimpleHTML(html: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  
  // Удаляем DOCTYPE и html/body теги
  let content = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .trim();
  
  // Разбиваем на блоки по основным тегам
  const blockRegex = /<(h[1-6]|p|ul|ol|table|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  
  while ((match = blockRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    const innerHtml = match[2];
    
    if (tag === 'ul' || tag === 'ol') {
      // Парсим список
      const items: ParsedNode[] = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(innerHtml)) !== null) {
        items.push({ tag: 'li', text: stripTags(liMatch[1]) });
      }
      nodes.push({ tag, text: '', children: items });
    } else if (tag === 'table') {
      // Пропускаем таблицы пока (можно добавить позже)
      nodes.push({ tag: 'p', text: '[Таблица]' });
    } else {
      // Обычный блок - проверяем на форматирование
      const children = parseInlineFormatting(innerHtml);
      nodes.push({ tag, text: stripTags(innerHtml), children });
    }
  }
  
  return nodes;
}

/**
 * Парсит inline форматирование (bold, italic)
 */
function parseInlineFormatting(html: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  const inlineRegex = /<(strong|b|em|i)[^>]*>(.*?)<\/\1>|([^<]+)/gi;
  let match;
  
  while ((match = inlineRegex.exec(html)) !== null) {
    if (match[1]) {
      // Тег форматирования
      nodes.push({ tag: match[1].toLowerCase(), text: match[2] });
    } else if (match[3]) {
      // Обычный текст
      const text = match[3].trim();
      if (text) {
        nodes.push({ tag: 'text', text });
      }
    }
  }
  
  return nodes.length > 0 ? nodes : [{ tag: 'text', text: stripTags(html) }];
}

/**
 * Удаляет HTML теги
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

export async function convertToDocx(html: string, job: ExportJob): Promise<Blob> {
  try {
    // Парсим HTML
    const parsed = parseSimpleHTML(html);
    
    // Создаём параграфы для документа
    const children: Paragraph[] = [];
    
    for (const node of parsed) {
      if (node.tag === 'h1') {
        children.push(
          new Paragraph({
            text: node.text,
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (node.tag === 'h2') {
        children.push(
          new Paragraph({
            text: node.text,
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (node.tag === 'h3') {
        children.push(
          new Paragraph({
            text: node.text,
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (node.tag === 'h4') {
        children.push(
          new Paragraph({
            text: node.text,
            heading: HeadingLevel.HEADING_4,
          })
        );
      } else if (node.tag === 'h5') {
        children.push(
          new Paragraph({
            text: node.text,
            heading: HeadingLevel.HEADING_5,
          })
        );
      } else if (node.tag === 'h6') {
        children.push(
          new Paragraph({
            text: node.text,
            heading: HeadingLevel.HEADING_6,
          })
        );
      } else if (node.tag === 'p' || node.tag === 'blockquote') {
        // Обрабатываем форматирование внутри параграфа
        const runs: TextRun[] = [];
        
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            runs.push(
              new TextRun({
                text: child.text,
                bold: child.tag === 'strong' || child.tag === 'b',
                italics: child.tag === 'em' || child.tag === 'i',
              })
            );
          }
        } else {
          runs.push(new TextRun(node.text));
        }
        
        children.push(
          new Paragraph({
            children: runs,
            spacing: { after: 200 },
          })
        );
      } else if (node.tag === 'ul' || node.tag === 'ol') {
        // Списки
        if (node.children) {
          for (let i = 0; i < node.children.length; i++) {
            const li = node.children[i];
            children.push(
              new Paragraph({
                text: li.text,
                bullet: node.tag === 'ul' ? { level: 0 } : undefined,
                numbering: node.tag === 'ol' ? { reference: 'default-numbering', level: 0 } : undefined,
              })
            );
          }
        }
      } else {
        // Обычный текст
        if (node.text.trim()) {
          children.push(
            new Paragraph({
              text: node.text,
              spacing: { after: 200 },
            })
          );
        }
      }
    }
    
    // Если нет контента, добавляем заголовок
    if (children.length === 0) {
      children.push(
        new Paragraph({
          text: job.title || 'Документ',
          heading: HeadingLevel.HEADING_1,
        })
      );
    }
    
    // Создаём документ
    const doc = new Document({
      numbering: {
        config: [{
          reference: 'default-numbering',
          levels: [{
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.START,
            style: {
              paragraph: { indent: { left: 720, hanging: 360 } },
            },
          }],
        }],
      },
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });
    
    // Генерируем Blob
    const blob = await Packer.toBlob(doc);
    return blob;
  } catch (error) {
    console.error('[docx] Conversion error:', error);
    throw new Error(`Failed to convert to DOCX: ${(error as Error).message}`);
  }
}
