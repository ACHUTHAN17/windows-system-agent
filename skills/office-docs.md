# Skill: office-docs — generate Word/Excel/PowerPoint/PDF locally AND on M365

Researched from Microsoft Graph docs, python-docx/openpyxl/python-pptx guides,
and officekit (MIT, agent-first). Three lanes — pick the smallest that works.

## Lane 1 — installed Office via COM (this machine has Office16: Word+Excel+PPT)
Tool: `office_run {app: word|excel|powerpoint, script}` (hidden, auto-quit).
`$app` is the COM application; save explicitly; result = script stdout.

```powershell
# Word report
$d=$app.Documents.Add(); $d.Content.Text="Monthly Report`nQ3 beats Q2.";
$d.SaveAs("C:/Reports/q3.docx"); $d.Close(); "saved"
# Word -> PDF: $d.ExportAsFixedFormat("C:/Reports/q3.pdf", 17)
# Excel fill: $b=$app.Workbooks.Add(); $s=$b.Worksheets.Item(1);
#   $s.Cells.Item(1,1)="Product"; $s.Cells.Item(1,2)=250;
#   $b.SaveAs("C:/Reports/sales.xlsx"); $b.Close()
# PowerPoint deck: $p=$app.Presentations.Add();
#   $s=$p.Slides.Add(1, 1); $s.Shapes.Title.TextFrame.TextRange.Text="Q3 Review";
#   $p.SaveAs("C:/Reports/q3.pptx"); $p.Close()
# PPT -> PDF: $p.ExportAsFixedFormat("C:/Reports/q3.pdf", 2)
```
Rules: Visible=$false already set; always SaveAs+Close (finally Quits anyway);
verify by reopening (file size > 0, or read back via python/COM).

## Lane 2 — Python stack (no Office needed, best for Linux/CI)
Setup once: `winget install Python.Python.3.12` (reopen shell) then
`pip install python-docx openpyxl python-pptx pypdf officekit`.
- `python-docx`: headings/paragraphs/tables/images/styles (no rendering).
- `openpyxl`: cells/formulas/charts/formatting (does NOT recalc — open in
  Excel/LibreOffice to compute, or write static values for snapshots).
- `python-pptx`: text replace, tables, NATIVE charts (editable in PPT);
  limits: animations, image-crop fidelity, theme-color inheritance, exact
  designer masters (python-pptx gets internal decks 100%, board packs ~80%).
- `officekit` (MIT, agent-first CLI + MCP server!): `officekit text/view/query/
  set/add/remove/merge/info/validate --json` across all three formats, plus
  14 MCP tools — wire via `MCP_SERVERS` (see skills/mcp.md).
- DOCX→PDF without Office: LibreOffice headless
  `soffice --headless --convert-to pdf file.docx`.

## Lane 3 — Microsoft 365 cloud (Graph API, OneDrive/SharePoint)
Auth (same device-flow pattern as skills/github.md): register app in
Entra ID (or use Graph Explorer), delegated flow, scopes
`Files.ReadWrite` (+`Sites.ReadWrite.All` for SharePoint). Token in `.env`
as `GRAPH_TOKEN` — never in chat/logs/repo.
- Upload/create (≤250MB): `PUT /me/drive/root:/Folder/Name.docx:/content`
  (body = binary; larger → createUploadSession, 320KiB-multiple chunks).
- Download/convert: `GET .../content`, or `.../content?format=pdf` for PDF.
- Excel cells API: `/me/drive/items/{id}/workbook/worksheets/{name}/range(address='A1:B2')`
  (PATCH values; `POST .../calculate`).
- Share: `POST .../createLink {type:"view"}` → webUrl.
- Templates: upload a `.dotx`-filled docx, then PATCH SharePoint listItem
  fields for metadata (Title/ContentType/custom columns).
Prefer `web_post`-style calls (see skills/file-fetch-upload.md upload pattern).

## Lane 0 — instant PDF (no Office, no Python)
`doc_pdf {tab, out}` prints any CDP tab to PDF (reports, invoices, receipts).
HTML file → debug browser → PDF. For Word-format output without Office, write
`.doc`-compatible HTML (Word opens HTML renamed to .doc) — honest fallback.

## Verify by artifact (always)
- DOCX: size>0, reopen (COM/python-docx), paragraph/table counts.
- XLSX: openpyxl load, expected sheets/cells, formulas present.
- PPTX: python-pptx slide/shape counts non-zero.
- PDF: page count via reader, spot-check text.
- M365: GET the driveItem back, compare size/updated time.
