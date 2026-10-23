import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Groove AR" },
      { name: "description", content: "Choose a new password for your Groove AR account." },
      { property: "og:title", content: "Set a new password — Groove AR" },
      { property: "og:description", content: "Choose a new password for your Groove AR account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // Recovery links land with #access_token=...&type=recovery; the client
      // picks the session up from the hash automatically.
      const isRecovery = window.location.hash.includes("type=recovery");
      setReady(Boolean(data.session) && isRecovery);
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) toast.error(error.message);
      else {
        toast.success("Password updated — you're signed in");
        nav({ to: "/", replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6">
        {ready === null ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !ready ? (
          <div className="space-y-3 text-center">
            <h1 className="text-lg font-bold">Link expired or invalid</h1>
            <p className="text-sm text-muted-foreground">Password reset links only work once. Request a fresh one from the sign-in page.</p>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold">Set a new password</h1>
            <form onSubmit={submit} className="space-y-3">
              <Input
                type="password"
                required
                minLength={6}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
