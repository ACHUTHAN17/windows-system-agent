# Skill: Papermorph An AI skill that turns books into animated, narrated, interactive web experiences

Auto-learned 2026-10-08 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Papermorph An AI skill that turns books into animated, narrated, interactive web experiences.

## Steps
1. Install Papermorph Install the Skill from your project directory with the Skills command: npx skills add DozenTwelve/Papermorph --skill papermorph --agent claude-code This adds the papermorph Skill for use with the claude-code agent
2. Create Your First Web Book After installation, open Claude Code with Opus 5.5 and provide a request that identifies the source PDF, the intended audience, and the scope of the first review
3. Run the Included Examples Locally The repository includes a site directory that you can serve locally
4. First, clone the project and move into its directory: git clone https://github.com/DozenTwelve/Papermorph.git cd Papermorph Start a local Python HTTP server for the site: python3 -m http.server 8765 -d site Then open http://localhost:8765/ in your browser to view the local examples
5. Use the local site: Run the included site locally when you want to inspect the examples from the repository
6. Install the Skill, run it in Claude Code with Opus 5.5, begin with one English chapter, and use the local example site to explore the resulting web experience

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - DozenTwelve/Papermorph: An AI skill that turns books into ...
  https://github.com/DozenTwelve/Papermorph
- GitHub - Artemsenik/papermorph: An AI skill that turns books into ...
  https://github.com/Artemsenik/papermorph
- Turn PDFs into Animated Interactive Web Books with Papermorph
  https://www.aiezz.com/en/tutorial/tutorial-dec4e6db830ffdd63597fcb1
