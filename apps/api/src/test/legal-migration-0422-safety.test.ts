import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../../../');
const SQL = readFileSync(
  join(ROOT, 'packages/db/migrations/0422_legal_documents.sql'),
  'utf8'
);

describe('0422 legal document migration safety', () => {
  it('marks only versions created by the carry-over seed', () => {
    expect(SQL).toContain(
      "INSERT INTO structured.terms_versions (doc, version, carried_over)"
    );
    expect(SQL).toContain("SELECT seed.doc::terms_doc_kind, 'v1.0', true");
  });

  it('never seeds clauses into a pre-existing unpublished draft', () => {
    expect(SQL).toMatch(
      /WHERE v\.doc = 'terms'[\s\S]*?AND v\.published_at IS NULL\s+AND v\.carried_over\s+AND NOT EXISTS/
    );
    expect(SQL).toMatch(
      /WHERE v\.doc = 'privacy'[\s\S]*?AND v\.published_at IS NULL\s+AND v\.carried_over\s+AND NOT EXISTS/
    );
  });

  it('publishes only the versions created by this migration', () => {
    expect(SQL).toMatch(
      /WHERE v\.doc = seed\.doc::terms_doc_kind\s+AND v\.published_at IS NULL\s+AND v\.carried_over\s+AND EXISTS/
    );
  });
});
