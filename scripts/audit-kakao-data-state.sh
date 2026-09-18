#!/usr/bin/env bash
set -euo pipefail

sudo -n docker exec -i weddingpick-api node <<'NODE'
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const queries = {
      analyses_pending: "SELECT count(*)::int AS n FROM structured.analyses WHERE status = 'pending'",
      analyses_stuck_running: "SELECT count(*)::int AS n FROM structured.analyses WHERE status = 'running' AND started_at < now() - interval '30 minutes'",
      raw_document_pages: "SELECT count(*)::int AS n FROM originals.raw_document_pages WHERE storage_key IS NOT NULL",
      vendor_images_internal: "SELECT count(*)::int AS n FROM structured.vendor_images WHERE storage_key IS NOT NULL",
      consultation_audio_present: "SELECT count(*)::int AS n FROM structured.consultation_records WHERE audio_key IS NOT NULL",
      consultation_audio_overdue: "SELECT count(*)::int AS n FROM structured.consultation_records WHERE audio_key IS NOT NULL AND audio_delete_by IS NOT NULL AND audio_delete_by <= now()",
      retention_due: "SELECT count(*)::int AS n FROM originals.document_retention_schedule WHERE deleted_at IS NULL AND retention_until IS NOT NULL AND retention_until <= now()",
      retention_unscheduled: "SELECT count(*)::int AS n FROM originals.document_retention_schedule WHERE deleted_at IS NULL AND retention_until IS NULL"
    };

    for (const [label, sql] of Object.entries(queries)) {
      const result = await pool.query(sql);
      console.log(label + '=' + (result.rows[0]?.n ?? 0));
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
NODE
