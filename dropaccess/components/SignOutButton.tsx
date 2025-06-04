"use client";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/auth";
      }}
    >
      Sign Out
    </Button>
  );
}