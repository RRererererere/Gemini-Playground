import { datetimeSkill } from './datetime';
import { calculatorSkill } from './calculator';
import { urlReaderSkill } from './url-reader';
import { notesSkill } from './notes';
import { qrGeneratorSkill } from './qr-generator';
import { tableGeneratorSkill } from './table-generator';
import { websiteBuilderSkill } from './website-builder';
import { officeExportSkill } from './office-export';
import imageAnalyserSkill from './image-analyser';
import { videoFrameExtractorSkill } from './video-frame-extractor/skill';
import fileEditorSkill from './file-editor';
import { agentCreatorSkill } from './agent-creator';
import type { Skill } from '../types';

export const BUILT_IN_SKILLS: Skill[] = [
  datetimeSkill,
  calculatorSkill,
  urlReaderSkill,
  notesSkill,
  qrGeneratorSkill,
  tableGeneratorSkill,
  websiteBuilderSkill,
  officeExportSkill,
  imageAnalyserSkill,
  videoFrameExtractorSkill,
  fileEditorSkill,
  agentCreatorSkill,
];

export { datetimeSkill, calculatorSkill, urlReaderSkill, notesSkill, qrGeneratorSkill, tableGeneratorSkill, websiteBuilderSkill, officeExportSkill, imageAnalyserSkill, videoFrameExtractorSkill, fileEditorSkill, agentCreatorSkill };
