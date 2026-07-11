const { createClient } = require('@supabase/supabase-js');
const supabase = createClient("https://tfonrkwnnfdpyurccvzl.supabase.co", "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki");

async function check() {
  const { data, error } = await supabase.from('sales').select('items').limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Success, items column exists.");
  }
}
check();
