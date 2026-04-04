import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const client = createClient(url, key);

async function listAll() {
  console.log('--- AUTH USERS ---');
  const { data: { users } } = await client.auth.admin.listUsers();
  users.forEach(u => console.log(`${u.email} | ID: ${u.id}`));

  console.log('\n--- PUBLIC USERS ---');
  const { data: profiles } = await client.from('users').select('email, id');
  profiles?.forEach(u => console.log(`${u.email} | ID: ${u.id}`));
}

listAll();
