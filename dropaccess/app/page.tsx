"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [status, setStatus] = useState("Not tested");

  const testSupabase = async () => {
    const { data, error } = await supabase.from("drops").select("*").limit(1);
    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus(`Success: Found ${data.length} rows`);
    }
  };

  return;
}