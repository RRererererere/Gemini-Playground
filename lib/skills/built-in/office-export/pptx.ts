/**
 * Office Export Skill — PPTX Converter
 * 
 * Конвертирует HTML секции в PowerPoint через pptxgenjs
 */

import PptxGenJS from 'pptxgenjs';
import { parseHtmlSlides } from './html-parser';
import type { ExportJob } from './types';

const THEME = {
  titleColor: '1a1a2e',
  textColor: '2d2d2d',
  accentColor: '4f46e5',  // индиго
  bgColor: 'ffffff',
  tableHeaderBg: 'eef2ff',
  tableBorder: 'c7d2fe',
  fontFace: 'Calibri',
};

export async function convertToPptx(html: string, job: ExportJob): Promise<Blob> {
  const pptx = new PptxGenJS();

  // Настройки презентации
  pptx.layout = job.orientation === 'landscape' ? 'LAYOUT_WIDE' : 'LAYOUT_16x9';
  pptx.author = 'Gemini Playground';
  pptx.title = job.title;
  pptx.subject = job.title;
  pptx.company = 'Gemini Playground';

  const slides = parseHtmlSlides(html);

  // Если слайдов нет — создаём титульный слайд
  if (slides.length === 0) {
    const slide = pptx.addSlide();
    slide.background = { color: THEME.bgColor };
    
    // Декоративная полоска
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.08,
      fill: { color: THEME.accentColor },
      line: { type: 'none' }
    });
    
    slide.addText(job.title, {
      x: 0.5, y: 2.5, w: '90%', h: 1.5,
      fontSize: 36, bold: true, color: THEME.titleColor,
      align: 'center', fontFace: THEME.fontFace
    });
    
    slide.addText('Создано в Gemini Playground', {
      x: 0.5, y: 4.2, w: '90%', h: 0.5,
      fontSize: 14, color: '999999',
      align: 'center', fontFace: THEME.fontFace
    });
  } else {
    // Создаём слайды из распарсенного HTML
    slides.forEach((slideData, idx) => {
      const slide = pptx.addSlide();
      slide.background = { color: THEME.bgColor };

      // Декоративная полоска сверху
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.08,
        fill: { color: THEME.accentColor },
        line: { type: 'none' }
      });

      // Номер слайда снизу справа
      slide.addText(`${idx + 1}`, {
        x: 0, y: '93%', w: '98%', h: 0.3,
        fontSize: 9, color: 'aaaaaa', align: 'right', fontFace: THEME.fontFace
      });

      // Заголовок слайда
      if (slideData.title) {
        slide.addText(slideData.title, {
          x: 0.5, y: 0.25, w: '90%', h: 0.9,
          fontSize: 28, bold: true, color: THEME.titleColor,
          fontFace: THEME.fontFace,
          valign: 'middle'
        });
        
        // Разделитель под заголовком
        slide.addShape(pptx.ShapeType.line, {
          x: 0.5, y: 1.1, w: '90%', h: 0,
          line: { color: THEME.accentColor, width: 1.5 }
        });
      }

      const contentY = slideData.title ? 1.35 : 0.4;
      const contentH = slideData.title ? 4.8 : 6.1;

      // Таблица (если есть)
      if (slideData.table && slideData.table.rows.length > 0) {
        type BorderStyle = { type: 'solid'; color: string; pt: number };
        const borderStyle: BorderStyle = { type: 'solid', color: THEME.tableBorder, pt: 0.5 };
        
        const tableRows = slideData.table.rows.map((row, rowIdx) =>
          row.map(cell => ({
            text: cell,
            options: {
              bold: rowIdx === 0 && slideData.table!.hasHeader,
              fill: { 
                color: rowIdx === 0 && slideData.table!.hasHeader 
                  ? THEME.tableHeaderBg 
                  : 'ffffff' 
              },
              color: THEME.textColor,
              fontSize: 12,
              fontFace: THEME.fontFace,
              border: [borderStyle, borderStyle, borderStyle, borderStyle] as [BorderStyle, BorderStyle, BorderStyle, BorderStyle],
              valign: 'middle' as const,
              align: 'left' as const
            }
          }))
        );

        slide.addTable(tableRows, {
          x: 0.5, 
          y: contentY, 
          w: '90%',
          autoPage: false,
          colW: slideData.table.colWidths.map(w => w / 10), // примерная конвертация
        });
      }
      // Буллеты (если нет таблицы или есть и то и другое)
      else if (slideData.bullets.length > 0) {
        const bulletItems = slideData.bullets.map(b => ({
          text: b.text,
          options: {
            bullet: b.level === 0 
              ? { type: 'bullet' as const } 
              : { type: 'bullet' as const, indent: 30 * b.level },
            fontSize: b.level === 0 ? 18 : 15,
            color: THEME.textColor,
            paraSpaceBefore: 4,
            paraSpaceAfter: 4,
            fontFace: THEME.fontFace
          }
        }));

        slide.addText(bulletItems, {
          x: 0.5, 
          y: contentY, 
          w: '90%', 
          h: contentH,
          valign: 'top'
        });
      }

      // Заметки (если есть)
      if (slideData.notes) {
        slide.addNotes(slideData.notes);
      }
    });
  }

  try {
    const buffer = await pptx.write({ outputType: 'arraybuffer' });
    return new Blob([buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
  } catch (error) {
    console.error('[pptx] Conversion error:', error);
    throw new Error(`Failed to convert to PPTX: ${(error as Error).message}`);
  }
}
