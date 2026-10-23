import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Groove AR" },
      { name: "description", content: "Request a password reset link for your Groove AR account." },
      { property: "og:title", content: "Reset your password — Groove AR" },
      { property: "og:description", content: "Request a password reset link for your Groove AR account." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6">
        {sent ? (
          <div className="space-y-3 text-center">
            <MailCheck className="mx-auto h-8 w-8 text-success" />
            <h1 className="text-lg font-bold">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">We sent a reset link to {email}. It opens a page where you can set a new password.</p>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold">Forgot your password?</h1>
            <p className="text-sm text-muted-foreground">Enter your account email and we'll send you a reset link.</p>
            <form onSubmit={submit} className="space-y-3">
              <Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Send reset link
              </Button>
            </form>
          </>
        )}
        <p className="text-center text-xs">
          <Link to="/auth" className="text-muted-foreground underline hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
