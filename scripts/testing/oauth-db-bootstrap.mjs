// LOCAL ONLY. Refuses any target other than this integration's Docker container.
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const container = 'supabase_db_ownlevel-oauth-mcp';
function sql(input) {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}
if (sql("select to_regclass('public.profiles');").includes('profiles')) {
  throw new Error('Local schema already initialized; no destructive reset is performed.');
}
for (const name of readdirSync('supabase/migrations').filter((n) => n.endsWith('.sql')).sort()) {
  console.log(`Apply ${name}`);
  sql(readFileSync(`supabase/migrations/${name}`, 'utf8'));
}
console.log('Local migrations applied.');
