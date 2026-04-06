import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

async function fixMissingProfiles() {
  console.log('--- Database Synchronization Start ---');
  
  // 1. List all auth users
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('Error listing auth users:', authError.message);
    return;
  }

  console.log(`Found ${users.length} total users in Auth.`);

  for (const user of users) {
    const email = user.email;
    const id = user.id;
    const metadata = user.user_metadata || {};

    // 2. Check if profile exists in public.users
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (profileError) {
      console.error(`Error checking profile for ${email}:`, profileError.message);
      continue;
    }

    if (!profile) {
      console.log(`[FIXING] User ${email} (ID: ${id}) has no profile. Creating...`);
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: id,
          email: email?.toLowerCase().trim(),
          name: metadata.name || 'Usuario',
          phone: metadata.phone || null,
          role: metadata.role || 'client',
          document_type: metadata.document_type || null,
          document_number: metadata.document_number || null,
          country: metadata.country || null,
          city: metadata.city || null,
          is_verified: true,
          created_at: user.created_at,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`  Failed to create profile for ${email}:`, insertError.message);
      } else {
        console.log(`  Successfully created profile for ${email}.`);
      }
    } else {
      // console.log(`[OK] User ${email} already has a profile.`);
    }
  }

  console.log('--- Sync Completed ---');
}

fixMissingProfiles();
