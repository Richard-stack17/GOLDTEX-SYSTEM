import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://tfonrkwnnfdpyurccvzl.supabase.co", "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki");
async function run() {
  const { data, error } = await supabase.from('sales').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0] || {}));
}
run();
