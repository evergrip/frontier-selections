import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

export default function Login() {
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [validatingInvite, setValidatingInvite] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteId) {
      validateInvite();
    }
  }, [inviteId]);

  const validateInvite = async () => {
    setValidatingInvite(true);
    setInviteError(null);
    try {
      const response = await base44.functions.invoke("validateInvite", { invitation_id: inviteId });
      const data = response.data;
      
      if (data.valid) {
        setInviteInfo(data.invitation);
        if (data.already_accepted) {
          // Invite already used - show message but allow login
          setInviteError({
            type: "already_accepted",
            message: data.message,
            icon: CheckCircle
          });
        }
        // Pre-fill email if available
        if (data.invitation?.email) {
          setEmail(data.invitation.email);
        }
      } else {
        // Invalid/expired/cancelled invite
        setInviteError({
          type: data.error || "invalid",
          message: data.message || "This invitation link is invalid.",
          icon: XCircle
        });
      }
    } catch (err) {
      console.error("Invite validation error:", err);
      setInviteError({
        type: "server_error",
        message: "Unable to validate invitation. Please check your link or contact support.",
        icon: AlertCircle
      });
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <AuthLayout
      icon={inviteError ? (inviteError.type === "already_accepted" ? CheckCircle : XCircle) : LogIn}
      title={
        inviteError 
          ? (inviteError.type === "already_accepted" ? "Welcome Back!" : "Invitation Issue")
          : (inviteInfo ? "You're Invited!" : "Welcome Back")
      }
      subtitle={
        inviteError
          ? inviteError.message
          : (inviteInfo ? `Join ${inviteInfo.customer_name || 'the project'}` : "Log in to your account")
      }
      footer={
        <>
          {!inviteError && (
            <>
              {inviteInfo ? "Already have an account? " : "Don't have an account? "}
              <Link to={inviteInfo ? "/login" : "/register"} className="text-primary font-medium hover:underline">
                {inviteInfo ? "Log in" : "Create one"}
              </Link>
            </>
          )}
        </>
      }
    >
      {validatingInvite && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-sm text-blue-900">Validating invitation...</p>
          </div>
        </div>
      )}

      {inviteError && (
        <div className={`mb-6 p-4 rounded-lg border ${
          inviteError.type === "already_accepted" 
            ? "bg-green-50 border-green-200" 
            : "bg-red-50 border-red-200"
        }`}>
          <div className="flex items-start gap-3">
            {inviteError.icon && <inviteError.icon className={`w-5 h-5 mt-0.5 ${
              inviteError.type === "already_accepted" ? "text-green-600" : "text-red-600"
            }`} />}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                inviteError.type === "already_accepted" ? "text-green-900" : "text-red-900"
              }`}>
                {inviteError.type === "already_accepted" ? "Already Accepted" : "Invitation Invalid"}
              </p>
              <p className={`text-sm mt-1 ${
                inviteError.type === "already_accepted" ? "text-green-700" : "text-red-700"
              }`}>
                {inviteError.message}
              </p>
              {inviteError.type !== "already_accepted" && (
                <p className="text-xs text-red-600 mt-3">
                  Please contact Frontier Building Group if you believe this is an error.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {inviteInfo && !inviteError && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Invitation Received</p>
              <p className="text-sm text-green-700 mt-1">
                You've been invited to access: <strong>{(inviteInfo.project_names || []).join(", ")}</strong>
              </p>
              <p className="text-xs text-green-600 mt-2">
                Create an account using this email to get started.
              </p>
              {inviteInfo.expiry_date && (
                <div className="flex items-center gap-2 mt-2 text-xs text-green-600">
                  <Clock className="w-3 h-3" />
                  <span>Expires: {new Date(inviteInfo.expiry_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
              readOnly={!!inviteInfo}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            inviteInfo ? "Accept Invitation & Log In" : "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}