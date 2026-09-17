# Skill: wordpress-build — build WordPress sites on the web (Windows host)

You build complete WordPress sites: install, theme, content, plugins, go-live.
Prefer WP-CLI/API over wp-admin clicking; use browser autopilot only when the API can't do it.

## 1. Stack on this Windows machine
- PHP + MySQL via **XAMPP** (`C:\xampp`) or **LocalWP**. Verify: `shell_exec php -v`, `shell_exec mysql --version`.
- WP-CLI: `shell_exec wp --version` (PATH) or download `wp-cli.phar` with `web_fetch` and run `php wp-cli.phar`.
- Each site gets its own folder, e.g. `C:\Users\ADMIN\Documents\sites\<name>` or `C:\xampp\htdocs\<name>`.

## 2. Fresh install (WP-CLI, fastest)
```
shell_exec: wp core download --path="<site>" 
shell_exec: wp config create --path="<site>" --dbname=<db> --dbuser=root --dbpass="" --dbhost=localhost
shell_exec: wp db create --path="<site>"
shell_exec: wp core install --path="<site>" --url="http://localhost/<name>" --title="<Title>" --admin_user=<user> --admin_password=<strongpass> --admin_email=<mail>
```
No WP-CLI? `web_fetch https://wordpress.org/latest.zip` → unzip → manual `wp-config.php` via `file_write` → open `http://localhost/<name>/wp-admin/install.php` with `app_open`.

## 3. Theme (child-first, never hack the parent)
- `shell_exec: wp theme install astra --activate --path="<site>"` (or GeneratePress/Kadence).
- Child theme via `file_write`: `<site>\wp-content\themes\<child>\style.css` (header + `@import`), `functions.php` (enqueue parent), then `wp theme activate <child>`.
- Custom templates go in the child theme (`front-page.php`, `page-<slug>.php`). Keep PHP 8-safe.

## 4. Content & plugins
- Pages/posts: `wp post create --post_type=page --post_title="..." --post_status=publish`, menus: `wp menu create/location/item`.
- Plugins: `wp plugin install <slug> --activate` (rankmath, wordfence, w3-total-cache, contact-form-7 / fluentforms).
- Media: `file_copy` into `wp-content\uploads\<yyyy>\<mm>\` then `wp media regenerate`.

## 5. Headless / REST automation (no UI needed)
- Create an **Application Password** once in wp-admin (Users → Profile), store in `.env`, never in chat.
- `web_fetch` GET `https://<site>/wp-json/wp/v2/posts` to read.
- `web_post` with Basic auth `(user:app-password base64)` to create/update posts, pages, media.
- Always `file_list/file_read` + backup (`file_copy` whole site + `wp db export backup.sql`) BEFORE destructive ops.

## 6. wp-admin via browser autopilot (fallback)
Only when REST/WP-CLI can't do it: `browser_debug_launch` (own profile!) → `browser_navigate` to `/wp-admin` → `browser_fill` login → `browser_click` through the flow → `browser_screenshot` to verify. Never use the user's live Edge profile for admin work.

## 7. Go-live checklist
SSL (https), permalinks `/%postname%/`, caching on, backups scheduled (UpdraftPlus), Wordfence scan clean, remove `admin` user / rename, `wp core update`, speed test, `eventlog_recent`/`disk_info` sanity on the host if self-hosted.

Safety: `ALLOWED_ROOTS` should include the sites dir; DB + files backup before every deploy step; secrets only via `.env`.
