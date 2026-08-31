import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const SUPABASE_URL = "https://tfonrkwnnfdpyurccvzl.supabase.co";
const SUPABASE_KEY = "sb_publishable_Q0fIbnnePd-ZXZY4ECXpAw_UybzSWki";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    transport: WebSocket
  }
});

async function test() {
  console.log("Connecting to Supabase Realtime channel for sales table...");
  const channel = supabase.channel('test_realtime_sales')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
      console.log("REALTIME EVENT RECEIVED!", payload);
    })
    .subscribe((status, err) => {
      console.log("Channel subscription status:", status, err ? err : '');
      if (status === 'SUBSCRIBED') {
        console.log("SUCCESS: Realtime is active on sales table in Supabase!");
        setTimeout(() => process.exit(0), 1000);
      }
    });

  setTimeout(() => {
    console.log("Timeout reached. Exiting.");
    process.exit(0);
  }, 5000);
}

test();
