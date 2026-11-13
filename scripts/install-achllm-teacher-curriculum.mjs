// Installs only the project-authored, attributable teacher lessons.  It is
// idempotent: records already listed in the local manifest are not re-added.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTeacherCurriculum } from '../src/teacher-curriculum.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
console.log(JSON.stringify(installTeacherCurriculum(root)));
