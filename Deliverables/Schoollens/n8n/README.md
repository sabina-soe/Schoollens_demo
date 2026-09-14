# n8n Workflows A–D (Section 7.3)

These are the intended Operator schedules. Live cron lives in n8n once a VPS + Apify token are available. The Operator Dashboard shows the same cadences.

Timezone for every trigger: `Asia/Yangon`.

## Workflow A — Official websites (monthly)

- Trigger: `0 9 1 * *`
- Read `schools.official_website_url` where the URL is present
- Run `scrapers/crawl_website.py <school_id>`
- Load JSON with `scrapers/load_raw_sources.py`
- Optional: `scrapers/extract_pdfs.py <school_id>`
- HTTP `POST /rag/extract` then `POST /rag/reconcile` per school
- Write `sync_jobs` (`source_type=website`, rows ingested, errors)

## Workflow B — Official Facebook pages (weekly)

- Trigger: `0 9 * * 1`
- Read current `official_facebook_url` values (operator edits take effect next run)
- Run the Apify Facebook posts actor for the last 1 month
- Load with `scrapers/load_raw_sources.py`
- HTTP `POST /rag/extract` then `POST /rag/reconcile`
- HTTP `POST /rag/analyze-comments`
- Write `sync_jobs` (`source_type=fb_page`)

## Workflow C — Facebook groups (weekly)

- Trigger: `0 10 * * 1`
- Run the Apify group crawl
- Insert `raw_sources` with `school_id=NULL`, `source_type=fb_group`
- HTTP `POST /rag/match-mentions` per new row
- Low-confidence matches stay in the Operator group-mention queue
- Write `sync_jobs` (`source_type=fb_group`)

## Workflow D — errors

- n8n Error Trigger on A–C
- Append the failure to `sync_jobs.errors` rather than dropping the cycle

Do not start these from the Next.js app. Thargyi / Mgpu announce; a person starts n8n on the VPS.
