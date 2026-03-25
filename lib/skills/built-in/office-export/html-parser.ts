/**
 * Office Export Skill — HTML Parser
 * 
 * Утилиты для парсинга HTML без DOM (через regex + строки)
 */

import type { ParsedTable, ParsedSlide } from './types';

/**
 * Извлекает HTML из markdown code block
 * Ищет ```html\n...\n``` или ```\n<...\n```
 */
export function extractHtmlFromMessage(text: string): string | null {
  // Попытка 1: ```html ... ```
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/i);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1].trim();
  }
  
  // Попытка 2: ``` <... ``` (без тега языка, но начинается с <)
  const genericMatch = text.match(/```\s*(<[\s\S]*?)```/);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].trim();
  }
  
  return null;
}

/**
 * Удаляет HTML теги и декодирует entities
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Парсит HTML таблицы без DOM
 * Возвращает массив ParsedTable
 */
export function parseHtmlTables(html: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  
  // Находим все <table>...</table>
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    
    // Проверяем наличие <thead>
    const hasHeader = /<thead[^>]*>/i.test(tableContent);
    
    // Извлекаем все <tr>
    const rows: string[][] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    
    while ((trMatch = trRegex.exec(tableContent)) !== null) {
      const rowContent = trMatch[1];
      const cells: string[] = [];
      
      // Извлекаем <th> и <td>
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const cellText = stripTags(cellMatch[1]);
        cells.push(cellText);
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (rows.length === 0) continue;
    
    // Вычисляем ширину колонок
    const numCols = Math.max(...rows.map(r => r.length));
    const colWidths: number[] = [];
    
    for (let col = 0; col < numCols; col++) {
      let maxWidth = 10; // минимум
      for (const row of rows) {
        if (row[col]) {
          maxWidth = Math.max(maxWidth, row[col].length + 4);
        }
      }
      colWidths.push(Math.min(maxWidth, 50)); // максимум 50
    }
    
    tables.push({
      rows,
      colWidths,
      hasHeader,
    });
  }
  
  return tables;
}

/**
 * Парсит HTML презентацию в слайды
 * Если есть <section> — разбивает по ним
 * Если нет — разбивает по <h2>
 */
export function parseHtmlSlides(html: string): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  
  // Попытка 1: разбить по <section>
  const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  const sections: string[] = [];
  let sectionMatch;
  
  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    sections.push(sectionMatch[1]);
  }
  
  // Если нашли секции — парсим их
  if (sections.length > 0) {
    for (const section of sections) {
      slides.push(parseSlideContent(section));
    }
    return slides;
  }
  
  // Попытка 2: разбить по <h2>
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches: Array<{ title: string; index: number }> = [];
  let h2Match;
  
  while ((h2Match = h2Regex.exec(html)) !== null) {
    h2Matches.push({
      title: stripTags(h2Match[1]),
      index: h2Match.index,
    });
  }
  
  if (h2Matches.length === 0) {
    // Нет ни секций, ни h2 — один слайд со всем контентом
    slides.push(parseSlideContent(html));
    return slides;
  }
  
  // Разбиваем контент между h2
  for (let i = 0; i < h2Matches.length; i++) {
    const start = h2Matches[i].index;
    const end = i < h2Matches.length - 1 ? h2Matches[i + 1].index : html.length;
    const content = html.substring(start, end);
    slides.push(parseSlideContent(content));
  }
  
  return slides;
}

/**
 * Парсит контент одного слайда
 */
function parseSlideContent(html: string): ParsedSlide {
  // Заголовок: первый <h1> или <h2>
  let title = '';
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  
  if (h1Match) {
    title = stripTags(h1Match[1]);
  } else if (h2Match) {
    title = stripTags(h2Match[1]);
  }
  
  // Буллеты: <p> и <li>
  const bullets: Array<{ text: string; level: number }> = [];
  
  // Парсим <p>
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const text = stripTags(pMatch[1]);
    if (text && text.length > 0) {
      bullets.push({ text, level: 0 });
    }
  }
  
  // Парсим <li> с определением уровня вложенности
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(html)) !== null) {
    const text = stripTags(liMatch[1]);
    if (text && text.length > 0) {
      // Определяем уровень по количеству <ul> перед этим <li>
      const beforeLi = html.substring(0, liMatch.index);
      const ulCount = (beforeLi.match(/<ul[^>]*>/gi) || []).length;
      const ulCloseCount = (beforeLi.match(/<\/ul>/gi) || []).length;
      const level = Math.max(0, ulCount - ulCloseCount - 1);
      
      bullets.push({ text, level: Math.min(level, 2) }); // макс 2 уровня
    }
  }
  
  // Таблица: первая <table>
  const tables = parseHtmlTables(html);
  const table = tables.length > 0 ? tables[0] : null;
  
  // Заметки: <aside>
  let notes: string | undefined;
  const asideMatch = html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/i);
  if (asideMatch) {
    notes = stripTags(asideMatch[1]);
  }
  
  return {
    title,
    bullets,
    table,
    notes,
  };
}
