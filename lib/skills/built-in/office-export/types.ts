/**
 * Office Export Skill — Type Definitions
 * 
 * Типы для экспорта HTML в Office форматы (DOCX, XLSX, PPTX)
 */

export interface ExportJob {
  format: 'docx' | 'xlsx' | 'pptx';
  filename: string;          // без расширения
  title: string;             // человекочитаемый заголовок
  sheetNames?: string[];     // для xlsx: имена листов
  orientation?: 'portrait' | 'landscape';
  createdAt: number;         // Date.now()
}

export interface ExportHistoryEntry {
  id: string;
  format: 'docx' | 'xlsx' | 'pptx';
  title: string;
  filename: string;
  createdAt: number;
}

export interface ParsedTable {
  rows: string[][];          // [rowIndex][colIndex] = cell text
  colWidths: number[];       // примерная ширина каждой колонки (кол-во символов)
  hasHeader: boolean;        // есть ли <thead>
}

export interface ParsedSlide {
  title: string;             // из <h2> или первого <h1>
  bullets: { text: string; level: number }[];   // из <p>, <li>
  table: ParsedTable | null; // из <table> если есть
  notes?: string;            // из <aside> если есть
}
