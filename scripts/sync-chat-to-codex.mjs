import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const CONVERSATION_ID = '57220cd1-41c5-43f2-8cb5-e1affeb4282f';
const WORKSPACE_DIR = 'C:\\Users\\arthu\\Downloads\\Breakbeat Pattern Maker';
const TRANSCRIPT_PATH = `C:\\Users\\arthu\\.gemini\\antigravity\\brain\\${CONVERSATION_ID}\\.system_generated\\logs\\transcript.jsonl`;
const CLAUDE_PROJECT_DIR = 'C:\\Users\\arthu\\.claude\\projects\\C--Users-arthu-Downloads-Breakbeat-Pattern-Maker';
const TARGET_JSONL_PATH = path.join(CLAUDE_PROJECT_DIR, `${CONVERSATION_ID}.jsonl`);

function cleanUserContent(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const match = raw.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return raw.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
            .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/g, '')
            .trim();
}

async function syncChatToCodex() {
  if (!fs.existsSync(TRANSCRIPT_PATH)) {
    console.error('Transcript not found at:', TRANSCRIPT_PATH);
    process.exit(1);
  }

  fs.mkdirSync(CLAUDE_PROJECT_DIR, { recursive: true });

  const rl = readline.createInterface({
    input: fs.createReadStream(TRANSCRIPT_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const lines = [];
  let parentUuid = null;

  // Header metadata lines for Claude / Codex importer
  lines.push(JSON.stringify({
    type: 'ai-title',
    aiTitle: 'Breakbeat Pattern Maker - Antigravity Sync',
    sessionId: CONVERSATION_ID,
  }));

  let userCount = 0;
  let assistantCount = 0;

  for await (const rawLine of rl) {
    if (!rawLine.trim()) continue;
    let step;
    try {
      step = JSON.parse(rawLine);
    } catch {
      continue;
    }

    const timestamp = step.created_at || new Date().toISOString();

    if (step.type === 'USER_INPUT' && step.source === 'USER_EXPLICIT') {
      const cleaned = cleanUserContent(step.content);
      if (!cleaned) continue;

      const uuid = crypto.randomUUID();
      const userRecord = {
        parentUuid,
        isSidechain: false,
        promptId: crypto.randomUUID(),
        type: 'user',
        message: {
          role: 'user',
          content: cleaned,
        },
        uuid,
        timestamp,
        permissionMode: 'auto',
        origin: { kind: 'human' },
        promptSource: 'sdk',
        userType: 'external',
        entrypoint: 'claude-desktop',
        cwd: WORKSPACE_DIR,
        sessionId: CONVERSATION_ID,
        version: '2.1.197',
        gitBranch: 'main',
      };

      lines.push(JSON.stringify(userRecord));
      parentUuid = uuid;
      userCount++;
    } else if (step.type === 'PLANNER_RESPONSE' && step.content) {
      const contentText = typeof step.content === 'string' ? step.content.trim() : '';
      if (!contentText) continue;

      const uuid = crypto.randomUUID();
      const assistantRecord = {
        parentUuid,
        isSidechain: false,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: contentText,
            },
          ],
        },
        uuid,
        timestamp,
        userType: 'external',
        entrypoint: 'claude-desktop',
        cwd: WORKSPACE_DIR,
        sessionId: CONVERSATION_ID,
        version: '2.1.197',
        gitBranch: 'main',
      };

      lines.push(JSON.stringify(assistantRecord));
      parentUuid = uuid;
      assistantCount++;
    }
  }

  fs.writeFileSync(TARGET_JSONL_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`Successfully synced chat transcript to Claude/Codex bridge:`);
  console.log(`- Path: ${TARGET_JSONL_PATH}`);
  console.log(`- Messages: ${userCount} user prompts, ${assistantCount} assistant turns`);
}

syncChatToCodex().catch((err) => {
  console.error('Error syncing chat:', err);
  process.exit(1);
});
