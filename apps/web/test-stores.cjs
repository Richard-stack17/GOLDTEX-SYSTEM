const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data: allStores, error } = await supabase.from('stores').select('*');
  console.log('Stores:', allStores);
  console.log('Error:', error);
}
test();
