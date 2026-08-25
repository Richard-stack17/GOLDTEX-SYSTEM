const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://tfonrkwnnfdpyurccvzl.supabase.co', 'sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki');
async function run() {
  const { data } = await supabase.from('printers').select('*').eq('is_active', true);
  console.log(JSON.stringify(data, null, 2));
}
run();
