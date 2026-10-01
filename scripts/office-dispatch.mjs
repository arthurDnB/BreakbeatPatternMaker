#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const WORKSPACE_DIR = 'C:\\Users\\arthu\\Downloads\\Breakbeat Pattern Maker';
const CODEX_THREAD_ID = '01a0c644-797a-7460-ae91-e2c408c9a751'; // "Design breakbeat pattern generator"
const ANTIGRAVITY_CONV_ID = '5933a981-330c-4146-b0b7-020be9094b79';
const CODEX_EXE = 'C:\\Users\\arthu\\AppData\\Local\\OpenAI\\Codex\\bin\\faa963e871dd422c\\codex.exe';
const AGENTAPI_EXE = 'C:\\Users\\arthu\\AppData\\Local\\Programs\\antigravity\\resources\\bin\\language_server.exe';

// Token-efficient model & reasoning configuration
const CODEX_TIERS = {
  plan: {
    model: 'gpt-6-luna',
    reasoning: 'medium',
    description: 'Lightweight planning & token-saving task scoping'
  },
  medium: {
    model: 'gpt-6-sol',
    reasoning: 'medium',
    description: 'Standard feature implementation & bug fixing'
  },
  hard: {
    model: 'gpt-6-sol',
    reasoning: 'high',
    description: 'Complex architecture, math/DSP & difficult algorithms'
  },
  ultra: {
    model: 'gpt-6-astra',
    reasoning: 'ultra',
    description: 'Deepest possible reasoning for massive refactors'
  }
};

function printHelp() {
  console.log(`
🏢 Autonomous AI Office Dispatcher
Usage:
  office assign --agent <codex|antigravity|deepseek> [--tier <plan|medium|hard|ultra>] [--mode <queue|exec>] "<task>"
  office notify --agent <codex|antigravity> "<message>"
  office verify
  office status

Examples:
  office assign --agent codex --tier plan "Scope and design MP3 export pipeline"
  office assign --agent codex --tier hard "Implement WAV to MP3 encoder worker thread"
  office assign --agent deepseek "Scaffold TypeScript types for MP3 metadata tags"
  office notify --agent antigravity "Codex finished task, ready for integration review"
  office verify
`);
}

function runCommand(cmd, args, opts = {}) {
  const isExe = cmd.toLowerCase().endsWith('.exe') || cmd === 'node';
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd || WORKSPACE_DIR,
    stdio: opts.stdio || 'inherit',
    shell: !isExe,
    env: { ...process.env, ...opts.env }
  });
  return result;
}

function assignToCodex(task, tierName = 'medium', mode = 'queue') {
  const tier = CODEX_TIERS[tierName] || CODEX_TIERS.medium;
  console.log(`\n👔 [Office Dispatch] Assigning HARD/SPECIALIST job to OpenAI Codex:`);
  console.log(`   - Tier: ${tierName.toUpperCase()} (${tier.description})`);
  console.log(`   - Model: ${tier.model} (Reasoning: ${tier.reasoning})`);
  console.log(`   - Mode: ${mode.toUpperCase()}`);
  console.log(`   - Task: "${task}"\n`);

  if (mode === 'queue') {
    // Queue directly to the user's open desktop chat session
    const fullMessage = `[OFFICE DISPATCH: ${tierName.toUpperCase()} TIER]\nModel: ${tier.model} | Reasoning: ${tier.reasoning}\n\nTask:\n${task}\n\nProtocol Reminder:\n1. Pull latest git & read DEVELOPMENT-LOG.md\n2. Run tests (npm.cmd test) before committing\n3. Log changes in DEVELOPMENT-LOG.md and notify Antigravity via agentapi send-message when done.`;
    const res = runCommand(CODEX_EXE, ['queue', '--thread', CODEX_THREAD_ID, '--message', fullMessage]);
    if (res.status === 0 && !res.error) {
      console.log(`✅ Successfully queued task into Codex chat ("Design breakbeat pattern generator")!`);
    } else {
      console.error(`❌ Failed to queue task to Codex.`);
      process.exit(res.status || 1);
    }
  } else {
    // Non-interactive background execution
    console.log(`⏳ Executing Codex non-interactively in workspace...`);
    const res = runCommand(CODEX_EXE, [
      'exec',
      '-m', tier.model,
      '-c', `model_reasoning_effort="${tier.reasoning}"`,
      task
    ]);
    if (res.status === 0 && !res.error) {
      console.log(`✅ Codex execution completed successfully.`);
    } else {
      process.exit(res.status || 1);
    }
  }
}

function assignToDeepSeek(task) {
  console.log(`\n👔 [Office Dispatch] Assigning EASY/SCAFFOLDING job to DeepSeek Harness:`);
  console.log(`   - Provider: NVIDIA NIM (DeepSeek V4.1 Flash @ 65k output limit)`);
  console.log(`   - Cost/Tokens: Unlimited / Zero-friction`);
  console.log(`   - Task: "${task}"\n`);

  console.log(`⏳ Executing DeepSeek Harness headless runner...`);
  const res = runCommand('npx.cmd', ['dsh', '--profile', 'headless', task]);
  if (res.status === 0 && !res.error) {
    console.log(`✅ DeepSeek Harness task completed.`);
  } else {
    console.log(`ℹ️ DeepSeek Harness headless task dispatched or finished.`);
  }
}

function assignToAntigravity(task) {
  console.log(`\n👔 [Office Dispatch] Assigning MEDIUM/INTEGRATION job to Antigravity (Google DeepMind):`);
  console.log(`   - Role: Project Lead & Integrator`);
  console.log(`   - Task: "${task}"\n`);

  const res = runCommand(AGENTAPI_EXE, ['agentapi', 'send-message', ANTIGRAVITY_CONV_ID, task]);
  if (res.status === 0 && !res.error) {
    console.log(`✅ Successfully notified Antigravity in active session!`);
  } else {
    console.error(`❌ Failed to notify Antigravity.`);
    process.exit(res.status || 1);
  }
}

function verifyOfficeWork() {
  console.log(`\n🧪 [Office Quality Gate] Verifying all workspace tests & build integrity...\n`);
  const testRes = runCommand('npm.cmd', ['test']);
  if (testRes.status !== 0 || testRes.error) {
    console.error(`\n❌ Unit tests failed with status ${testRes.status}.`);
    process.exit(testRes.status || 1);
  }

  const genreRes = runCommand('node', ['tests/groove-v5-genres.test.mjs']);
  if (genreRes.status !== 0 || genreRes.error) {
    console.error(`\n❌ Genre unit tests failed with status ${genreRes.status}.`);
    process.exit(genreRes.status || 1);
  }

  const smokeRes = runCommand('node', ['scripts/groove-v5-browser-smoke.mjs']);
  if (smokeRes.status !== 0 || smokeRes.error) {
    console.error(`\n❌ Browser smoke tests failed with status ${smokeRes.status}.`);
    process.exit(smokeRes.status || 1);
  }

  console.log(`\n✅ ALL TESTS PASSING! Work meets quality gate standards.`);
}

function showStatus() {
  console.log(`\n📊 [Office Status & Overview]`);
  console.log(`-----------------------------------------------`);
  console.log(`🏢 Workspace: ${WORKSPACE_DIR}`);
  console.log(`🤖 Codex Active Chat: ${CODEX_THREAD_ID}`);
  console.log(`🧠 Antigravity Session: ${ANTIGRAVITY_CONV_ID}`);
  console.log(`⚡ DeepSeek Ceiling: 65,536 tokens (cordis.patch.yml)`);
  console.log(`-----------------------------------------------\n`);

  console.log(`🔍 Git Status:`);
  runCommand('git', ['status', '--short']);
}

// CLI Arg Parsing
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

if (command === 'status') {
  showStatus();
} else if (command === 'verify') {
  verifyOfficeWork();
} else if (command === 'notify') {
  const agentIdx = args.indexOf('--agent');
  const agent = agentIdx !== -1 ? args[agentIdx + 1] : 'antigravity';
  const message = args[args.length - 1];
  if (agent === 'antigravity') {
    assignToAntigravity(message);
  } else if (agent === 'codex') {
    assignToCodex(message, 'medium', 'queue');
  }
} else if (command === 'assign') {
  const agentIdx = args.indexOf('--agent');
  const tierIdx = args.indexOf('--tier');
  const modeIdx = args.indexOf('--mode');
  
  const agent = agentIdx !== -1 ? args[agentIdx + 1] : 'codex';
  const tier = tierIdx !== -1 ? args[tierIdx + 1] : 'medium';
  const mode = modeIdx !== -1 ? args[modeIdx + 1] : 'queue';
  const task = args[args.length - 1];

  if (!task || task.startsWith('--')) {
    console.error('Error: Please provide a task description.');
    printHelp();
    process.exit(1);
  }

  if (agent === 'codex') {
    assignToCodex(task, tier, mode);
  } else if (agent === 'deepseek') {
    assignToDeepSeek(task);
  } else if (agent === 'antigravity') {
    assignToAntigravity(task);
  } else {
    console.error(`Unknown agent: ${agent}. Choose codex, antigravity, or deepseek.`);
  }
} else {
  printHelp();
}
