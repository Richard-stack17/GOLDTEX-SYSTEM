const url = "https://tfonrkwnnfdpyurccvzl.supabase.co/rest/v1";
const key = "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki";

async function fetchTable(table) {
  const res = await fetch(`${url}/${table}?select=*&limit=1`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`
    }
  });
  if (!res.ok) {
    const error = await res.json();
    console.log(`${table.toUpperCase()} Error:`, error.message || error.hint || error);
    return;
  }
  const data = await res.json();
  console.log(`${table.toUpperCase()} KEYS:`);
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
  } else {
    console.log(`${table} exists but is empty`);
  }
}

async function run() {
  await fetchTable('sales');
  await fetchTable('transactions');
  await fetchTable('sale_items');
  await fetchTable('items');
  await fetchTable('ticket_details');
}
run();
