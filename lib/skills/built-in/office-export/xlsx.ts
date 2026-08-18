/**
 * Office Export Skill — XLSX Converter
 * 
 * Конвертирует HTML таблицы в Excel через xlsx (SheetJS)
 */

import * as XLSX from 'xlsx';
import { parseHtmlTables } from './html-parser';
import type { ExportJob } from './types';

export async function convertToXlsx(html: string, job: ExportJob): Promise<Blob> {
  const tables = parseHtmlTables(html);

  if (tables.length === 0) {
    // Нет таблиц — создаём лист с сообщением
    const workbook = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Нет данных для отображения'],
      [''],
      ['HTML не содержит таблиц.'],
      ['Используйте <table> элементы для создания Excel листов.']
    ]);
    
    // Стилизация (базовая)
    ws['!cols'] = [{ wch: 50 }];
    
    XLSX.utils.book_append_sheet(workbook, ws, 'Sheet1');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
  }

  const workbook = XLSX.utils.book_new();

  tables.forEach((table, i) => {
    const sheetName = sanitizeSheetName(job.sheetNames?.[i] ?? `Sheet${i + 1}`);
    const ws = XLSX.utils.aoa_to_sheet(table.rows);

    // Ширины колонок
    ws['!cols'] = table.colWidths.map(w => ({ wch: Math.min(w, 50) }));

    // Freeze первую строку если есть header
    if (table.hasHeader && table.rows.length > 1) {
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    // Автофильтр для header
    if (table.hasHeader && table.rows.length > 0) {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
    }

    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  try {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  } catch (error) {
    console.error('[xlsx] Conversion error:', error);
    throw new Error(`Failed to convert to XLSX: ${(error as Error).message}`);
  }
}

/**
 * Санитизирует имя листа для Excel
 * Excel ограничения: макс 31 символ, нельзя: \ / ? * [ ]
 */
function sanitizeSheetName(name: string): string {
  return name
    .replace(/[\\/?*[\]]/g, '')
    .slice(0, 31) || 'Sheet';
}
