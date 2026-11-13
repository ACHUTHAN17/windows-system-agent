// Small, original lesson pack for AchLLM.  These lessons are intentionally
// authored for this project; they do not copy a provider model's weights,
// private conversations, or unlicensed web material.
import { appendRecords } from './seed-training.js';

export const TEACHER_CURRICULUM_LICENSE = 'AchLLM authored curriculum — proprietary training material';
export const TEACHER_CURRICULUM_SOURCE = 'AchLLM teacher curriculum v1';

const lessons = [
  ['uncertainty', 'How should an assistant answer when it does not know a fact?', 'Say what is unknown, ask for a reliable source or context, and do not invent a confident answer.'],
  ['decomposition', 'How do I begin a complex programming task?', 'Restate the goal, identify inputs and constraints, divide it into small testable steps, implement one step at a time, then verify the result.'],
  ['testing', 'Why should code be tested?', 'Tests check that expected behavior stays correct as code changes. Start with a small reproducible case, test normal and error paths, and keep a regression test for each fixed bug.'],
  ['python-hello', 'Write a Python program that prints hello.', '```python\nprint("hello")\n```'],
  ['javascript-function', 'Write a JavaScript function that adds two numbers.', '```javascript\nfunction add(a, b) {\n  return a + b;\n}\n```'],
  ['debugging', 'What is a safe debugging process?', 'Reproduce the issue, capture the exact error, reduce it to the smallest failing case, inspect assumptions, make one change, and rerun the same test.'],
  ['algorithm', 'What is an algorithm?', 'An algorithm is a finite ordered procedure that transforms inputs into an output and has a clear stopping condition.'],
  ['complexity', 'What does Big O describe?', 'Big O describes how an algorithm’s time or memory use grows as input size grows. It is a growth-rate estimate, not a stopwatch measurement.'],
  ['http', 'What do HTTP status codes mean?', 'They report the result of a web request. For example, 200 means success, 400 means the request is invalid, 401 means authentication is needed, 403 means forbidden, and 404 means not found.'],
  ['database', 'What is a database?', 'A database stores structured information so it can be safely created, queried, updated, and protected.'],
  ['git', 'What is a useful Git commit?', 'A useful commit makes one coherent change, includes the related tests, has a clear message, and leaves the project in a working state.'],
  ['security', 'How should an assistant handle a password or API key?', 'Treat it as sensitive. Do not log it, include it in training data, publish it, or repeat it. Use the minimum access required and rotate exposed credentials.'],
  ['files', 'How should an assistant safely change files?', 'Inspect the target first, change only the requested files, keep a clear record of the change, verify the result, and avoid destructive operations unless explicitly authorized.'],
  ['sorting', 'How can a list of numbers be sorted in Python?', '```python\nvalues = [3, 1, 2]\nvalues.sort()\nprint(values)  # [1, 2, 3]\n```'],
  ['networking', 'What is a computer network?', 'A computer network connects devices so they can exchange data using agreed rules called protocols.'],
  ['citations', 'When should an assistant cite a source?', 'Cite a source when a claim comes from external material, can change over time, or needs verification. The citation should point to the specific source supporting the claim.'],
  ['review', 'What should a code review look for?', 'Check correctness, security, error handling, tests, maintainability, and whether the change stays within the requested scope.'],
  ['plan', 'How should an agent plan a task?', 'Define the outcome, list dependencies and risks, choose bounded steps, verify each important result, and stop or ask when required authority is missing.'],
];

export function teacherCurriculumRecords() {
  return lessons.map(([id, prompt, answer]) => ({
    id: `achllm-teacher-v1-${id}`,
    source: TEACHER_CURRICULUM_SOURCE,
    title: `AchLLM teacher lesson: ${id}`,
    teacher: 'AchLLM project-authored lesson',
    domain: /```/.test(answer) ? 'code' : 'chat',
    license: TEACHER_CURRICULUM_LICENSE,
    text: `user: ${prompt}\nassistant: ${answer}`,
    collectedAt: '2026-11-13T00:00:00.000Z',
  }));
}

export function installTeacherCurriculum(root) {
  const records = teacherCurriculumRecords();
  return { available: records.length, added: appendRecords(root, records), source: TEACHER_CURRICULUM_SOURCE };
}
