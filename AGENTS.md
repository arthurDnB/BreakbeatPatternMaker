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
