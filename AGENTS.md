# AI Assistant Guidelines & Protocols (Antigravity, Codex, etc.)

> **MANDATORY POLICY:** Every AI assistant (OpenAI Codex, Antigravity, GitHub Copilot, etc.) working on this repository MUST strictly follow the two-step sync protocol below for every single task or change.

---

## 🚨 The Mandatory Two-Step Protocol

### STEP 1: BEFORE Making Any Changes (Sync & Catch Up)
1. **Check Git Status and Pull Latest Remote Changes:**
   Always pull to ensure you have the latest work done by the other assistant or developer:
   ```bash
   git pull origin main
   ```
2. **Read `DEVELOPMENT-LOG.md`:**
   Review the latest entries in `DEVELOPMENT-LOG.md` to see what was just modified, the current state of tests, and the immediate roadmap task.

---

### STEP 2: AFTER Making Any Changes (Verify, Document & Deploy)
1. **Verify All Tests Pass:**
   Run the test suite to ensure no regressions were introduced:
   * On Windows (PowerShell/CMD):
     ```cmd
     npm.cmd test
     ```
   * *Do NOT commit code if tests fail.*
2. **Document Your Work in `DEVELOPMENT-LOG.md`:**
   Add a new entry to the `## Change Log` section with:
   * Date
   * Assistant name (e.g., `Codex`, `Antigravity`)
   * Bullet points detailing what files were changed, what feature was added or fixed, and the rationale.
3. **Commit and Push to GitHub:**
   ```bash
   git add .
   git commit -m "<clear, descriptive commit message>"
   git push origin main
   ```
   * **Note:** Pushing to `origin main` automatically triggers `.github/workflows/deploy.yml` which tests, builds, and updates the live site at `https://arthurdnb.github.io/BreakbeatPatternMaker/`.

---

## 🏢 The Autonomous AI Office Architecture

Arthur is **The Boss**. Work is distributed hierarchically across three specialized AI agents based on task complexity and token efficiency:

### 1. The Roles & Specializations
* **Arthur (The Boss):** Sets roadmap priorities, approves feature scopes, and directs the team.
* **OpenAI Codex (Senior Specialist — Hard Jobs):**
  - High-complexity algorithms, core audio DSP engines, Web Workers, intricate state synchronization, and difficult debugging.
* **Antigravity / Google DeepMind (Project Lead & Integrator — Medium Jobs):**
  - Task decomposition, multi-file integration, verification & quality gates, code reviews, git repository deployment, and inter-agent coordination.
* **DeepSeek Harness (Junior Developer & Scaffolder — Medium/Easy Jobs):**
  - High-volume boilerplate, type definitions, asset catalog updates, exploratory pattern variations, and docs. Operates on NVIDIA NIM with a 65,536 token output window.

---

### 2. Token-Saving Model & Reasoning Tiering
To maximize performance while conserving tokens, all agents follow this tiering:

| Phase / Complexity | Codex Model | Codex Reasoning Effort | Antigravity Model | Assigned Agent |
|---|---|---|---|---|
| **Planning & Scoping** | `gpt-6-luna` | `medium` | `flash` | Any (Luna / Flash) |
| **Standard / Medium** | `gpt-6-sol` | `medium` | `flash` / standard | Antigravity / Codex |
| **Hard / Heavy DSP** | `gpt-6-sol` / `gpt-6-astra` | `high` / `ultra` | `pro` | Codex |
| **Scaffolding / Easy** | — | — | — | DeepSeek Harness |

*Rule:* Never use `astra` or `ultra` reasoning for initial planning or boilerplate. Always scope with `luna` or `flash` first.

---

### 3. 💬 Direct Inter-Agent Messaging & Office Dispatcher
All agents can communicate with each other in real-time or dispatch work via the `office` CLI:

* **Global Office Dispatcher CLI:**
  ```cmd
  office assign --agent codex --tier <plan|medium|hard|ultra> "<task description>"
  office assign --agent deepseek "<scaffolding task description>"
  office assign --agent antigravity "<integration task description>"
  office verify      # Runs the entire test suite & quality gate
  office status      # Inspects git and active agent sessions
  ```

* **Codex $\rightarrow$ Antigravity Wakeup:**
  When Codex finishes a task and pushes to git, Codex runs:
  ```cmd
  agentapi send-message 5933a981-330c-4146-b0b7-020be9094b79 "Antigravity, I pushed the changes. Please pull, review, and verify."
  ```

* **Antigravity $\rightarrow$ Codex Dispatch:**
  When Antigravity assigns a task to Codex's active desktop chat ("Design breakbeat pattern generator"):
  ```cmd
  codex queue --thread 01a0c644-797a-7460-ae91-e2c408c9a751 --message "<Task prompt with tier & rules>"
  ```

