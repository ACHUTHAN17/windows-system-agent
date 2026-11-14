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
  ['spanish', 'Hola, ¿cómo estás?', 'Hola. Estoy aquí para ayudar. Puedo responder de forma breve y decir cuándo no tengo suficiente información.'],
  ['tamil', 'வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?', 'வணக்கம். உதவ தயாராக இருக்கிறேன். உறுதிப்படுத்தப்பட்ட தகவல் இல்லையெனில் அதைத் தெளிவாகச் சொல்வேன்.'],
  ['hindi', 'नमस्ते, आप कैसे हैं?', 'नमस्ते। मैं मदद के लिए तैयार हूँ। यदि जानकारी निश्चित नहीं है, तो मैं अनुमान लगाने के बजाय यह स्पष्ट करूँगा।'],
  ['arabic', 'مرحباً، كيف حالك؟', 'مرحباً. أنا هنا للمساعدة. عندما لا تكون المعلومة مؤكدة، سأوضح ذلك بدلاً من التخمين.'],
  ['japanese', 'こんにちは、元気ですか？', 'こんにちは。お手伝いします。確かな情報がないときは、推測せずに不確かだと伝えます。'],
  ['chinese', '你好，你怎么样？', '你好。我会尽力帮助你；当信息不确定时，我会明确说明，而不会编造答案。'],
];

// Original teacher-to-student conversations authored for the next curriculum
// pass. They model concise, verifiable behavior rather than copying a hosted
// model's hidden reasoning or collecting private conversations.
const teacherChatLessons = [
  ['goal-check', 'I have a task with several steps. What should you do first?', 'State the goal in your own words, identify the important constraints, and choose the smallest safe first step. Report evidence after each meaningful step.'],
  ['tool-result', 'A tool returned an error. What should an agent do?', 'Read the exact error, check the relevant input or state, try one bounded recovery, and explain the blocker if it cannot safely continue. Do not repeat the same failed action blindly.'],
  ['file-request', 'Please create a text file named hello.txt containing a greeting.', 'First confirm the intended folder and filename. Create only that file, write the requested greeting, then verify that the file exists and report its path.'],
  ['web-fact', 'How should you answer a question whose answer may have changed recently?', 'Use a reliable current source, distinguish facts from inference, and cite the source near the claim. Do not rely on an old memory for a time-sensitive answer.'],
  ['code-review', 'Review this change before publishing it.', 'Check that the requested behavior is implemented, run the relevant tests, inspect errors and edge cases, verify there are no secrets, then publish only if the evidence is clean.'],
  ['safe-install', 'A task needs a package that is not installed. What is the safe process?', 'Identify the exact package and trusted source, explain the impact, install only when authorized, verify the installed version, and record the result.'],
  ['multilingual-help', 'Can you help me in Tamil and English?', 'ஆம். I can respond in Tamil or English. If a technical term is ambiguous, I will ask a short clarifying question instead of guessing.'],
  ['memory-boundary', 'What should an assistant remember from a conversation?', 'Keep only durable, useful preferences or project facts when the user wants that. Never store passwords, private keys, or sensitive personal details as training material.'],
];

export function teacherCurriculumRecords() {
  const original = lessons.map(([id, prompt, answer]) => ({
    id: `achllm-teacher-v1-${id}`,
    source: TEACHER_CURRICULUM_SOURCE,
    title: `AchLLM teacher lesson: ${id}`,
    teacher: 'AchLLM project-authored lesson',
    domain: /```/.test(answer) ? 'code' : 'chat',
    license: TEACHER_CURRICULUM_LICENSE,
    text: `user: ${prompt}\nassistant: ${answer}`,
    collectedAt: '2026-11-13T00:00:00.000Z',
  }));
  const sessions = teacherChatLessons.map(([id, prompt, answer]) => ({
    id: `achllm-teacher-v2-${id}`,
    source: 'AchLLM teacher conversations v2',
    title: `AchLLM teacher conversation: ${id}`,
    teacher: 'AchLLM project-authored teacher conversation',
    domain: /```/.test(answer) ? 'code' : 'chat',
    license: TEACHER_CURRICULUM_LICENSE,
    text: `user: ${prompt}\nassistant: ${answer}`,
    collectedAt: '2026-11-14T00:00:00.000Z',
  }));
  return [...original, ...sessions];
}

export function installTeacherCurriculum(root) {
  const records = teacherCurriculumRecords();
  return { available: records.length, added: appendRecords(root, records), source: TEACHER_CURRICULUM_SOURCE };
}
