import { datetimeSkill } from './datetime';
import { calculatorSkill } from './calculator';
import { urlReaderSkill } from './url-reader';
import { notesSkill } from './notes';
import { qrGeneratorSkill } from './qr-generator';
import { tableGeneratorSkill } from './table-generator';
import type { Skill } from '../types';

export const BUILT_IN_SKILLS: Skill[] = [
  datetimeSkill,
  calculatorSkill,
  urlReaderSkill,
  notesSkill,
  qrGeneratorSkill,
  tableGeneratorSkill,
];

export { datetimeSkill, calculatorSkill, urlReaderSkill, notesSkill, qrGeneratorSkill, tableGeneratorSkill };
