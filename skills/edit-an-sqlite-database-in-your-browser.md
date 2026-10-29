# Skill: Edit an SQLite database in your browser

Auto-learned 2026-10-29 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Edit an SQLite database in your browser.

## Steps
1. Open a .sqlite or .db file from your computer: it is read into memory here and never uploaded
2. Download the changed database when you are done
3. Download database saves the current database, including your changes, as playground.sqlite
4. How we know: Written from the playground's own code and the official sql.js and SQLite documentation, checked on 8 October 2026
5. Run queries with Run or Ctrl+Enter ( Cmd+Enter on a Mac)
6. How SQLite Is Tested &rarr; The reliability and robustness of SQLite is achieved in large part by thorough and careful testing
7. How To Compile SQLite &rarr; Instructions and hints for compiling SQLite C code and integrating that code with your own application
8. Open a SQLite file, a .sql dump or a CSV , edit the data in a grid or with SQL, then download a fresh file
9. Open a database Start blank Import CSV Try a sample → Resume last session .sqlite / .db · .sql dumps (MySQL, Postgres, SQLite) · .csv — or drop a file anywhere on the page
10. How it stays safe rebuild, don't operate in place Every editor of precious files picks one of two paths: change the bytes inside the file (fast, and one wrong offset corrupts it for good) or rebuild the whole file on save

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- SQLite Online: Open, Edit & Query SQLite Files in Your Browser
  https://codewithsql.com/playground/sqlite
- Documentation - SQLite
  https://sqlite.org/docs.html
- SQLite Editor Online — Open, Edit & Export DB In Your Browser
  https://editsqlite.com/
