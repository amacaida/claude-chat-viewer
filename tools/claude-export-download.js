/*
 * claude-export: download every file in a Claude data-export manifest.
 *
 * Run from a DevTools snippet or the console on a signed-in claude.ai tab.
 * It asks for the manifest JSON (pasting just the export links also works),
 * trades each export link for a short-lived storage URL, and starts the
 * downloads 5 s apart. Each storage URL is logged; with "Preserve log" on,
 * you can reopen one if its download fails. Redeeming a link uses it up.
 *
 * Notes for a future agent (endpoint read from the claude.ai page code on
 * 2026-11-08; confirmed working on a real export on 2026-11-09):
 * - An export_url (claude.ai/export/<orgUuid>/download/<nonce>) is a page,
 *   not a file. Fetching it without a browser returns the app's HTML shell.
 * - That page (route "export/$orgUuid/download/$nonce", component
 *   ExportDownloadRoute, loaded lazily) POSTs to
 *   /organizations/<orgUuid>/export_signed_url/<nonce> with the session
 *   cookie. This script assumes the app's usual /api prefix.
 * - Success returns JSON with download_url or signed_url. Behind a feature
 *   flag it may instead return files[] (one link, several files); this
 *   script does not handle that case.
 * - Failures put a code at body.error.details.error_code, such as
 *   account_session_invalid, incorrect_user, export_consumed,
 *   export_expired, or too_many_downloads.
 * - If the format drifts, fetch an export_url, open the index-*.js it loads
 *   from assets-proxy.anthropic.com, follow the lazy chunk that
 *   ExportDownloadRoute imports, and search it for "export_signed_url" and
 *   "download_url". Also check the manifest fields used below:
 *   data_files[].export_url and data_files[].filename.
 */
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const input = prompt("Paste the export manifest JSON:");
  if (!input) return console.warn("Cancelled.");

  // Read the manifest; if the JSON won't parse, fall back to pulling the links out of the text.
  let files;
  try {
    files = JSON.parse(input).data_files.map((f) => ({ name: f.filename, link: f.export_url }));
  } catch {
    files = [...input.matchAll(/https:\/\/claude\.ai\/export\/[^\s"']+/g)].map((m, i) => ({
      name: `file ${i + 1}`,
      link: m[0],
    }));
  }
  if (!files.length) return console.error("No export links found in what you pasted.");
  console.log(`Found ${files.length} files.`);

  const done = [];
  for (const f of files) {
    const m = new URL(f.link).pathname.match(/^\/export\/([^/]+)\/download\/([^/]+)$/);
    if (!m) {
      console.warn("Skipping unrecognized link:", f.name);
      continue;
    }
    const [, org, nonce] = m;

    // Same call the export page makes: trade the link for a short-lived storage URL.
    const res = await fetch(`/api/organizations/${org}/export_signed_url/${nonce}`, {
      method: "POST",
      credentials: "include",
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
      // Non-JSON response; the status code below still reports the failure.
    }
    if (!res.ok) {
      console.error(f.name, res.status, body?.error?.details?.error_code ?? body);
      continue;
    }
    const url = body.download_url || body.signed_url;
    if (!url) {
      console.error(f.name, "no download URL in response:", body);
      continue;
    }

    console.log("Downloading", f.name, url);
    done.push({ file: f.name, url });
    window.location.assign(url); // the file downloads; the tab stays on claude.ai
    await sleep(5000); // spacing avoids "too_many_downloads"
  }
  console.table(done);
})();
