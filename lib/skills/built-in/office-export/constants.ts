/**
 * Office Export Skill — Constants
 * 
 * MIME типы, иконки, лейблы и ключи хранилища
 */

export const MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export const FORMAT_ICONS = {
  docx: '📝',
  xlsx: '📊',
  pptx: '📽️',
} as const;

export const FORMAT_LABELS = {
  docx: 'Word Document',
  xlsx: 'Excel Spreadsheet',
  pptx: 'PowerPoint Presentation',
} as const;

export const STORAGE_KEYS = {
  pendingJob: 'pending_export_job',
  history: 'export_history',
  totalCount: 'total_exports',
} as const;
