/**
 * Office Export Skill — Main Converter
 * 
 * Точка входа в конвертацию HTML → Office форматы
 */

import { convertToDocx } from './docx';
import { convertToXlsx } from './xlsx';
import { convertToPptx } from './pptx';
import type { ExportJob } from './types';

export async function convertToOffice(html: string, job: ExportJob): Promise<Blob> {
  switch (job.format) {
    case 'docx':
      return convertToDocx(html, job);
    case 'xlsx':
      return convertToXlsx(html, job);
    case 'pptx':
      return convertToPptx(html, job);
    default:
      throw new Error(`Unsupported format: ${(job as ExportJob).format}`);
  }
}
