import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://tfonrkwnnfdpyurccvzl.supabase.co", "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki");

async function run() {
  const { data: sales, error: err1 } = await supabase.from('sales').select('*').limit(1);
  const { data: tx, error: err2 } = await supabase.from('transactions').select('*').limit(1);
  const { data: items, error: err3 } = await supabase.from('sale_items').select('*').limit(1);
  
  console.log("SALES KEYS:");
  if (sales && sales[0]) console.log(Object.keys(sales[0]));
  
  console.log("TRANSACTIONS KEYS:");
  if (tx && tx[0]) console.log(Object.keys(tx[0]));
  
  console.log("SALE_ITEMS Error/Keys:");
  if (err3) console.log(err3.message);
  else if (items && items[0]) console.log(Object.keys(items[0]));
  else console.log("sale_items exists but is empty");
}
run();
