import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Mail, Loader2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EmailSettings() {
  const [configured, setConfigured] = useState(null);
  const [provider, setProvider] = useState("Unknown");
  const [lastError, setLastError] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    checkEmailConfig();
  }, []);

  async function checkEmailConfig() {
    try {
      const res = await base44.functions.invoke("sendNotifications", {
        action: "checkConfig"
      });
      setConfigured(res.data?.configured || false);
      setProvider(res.data?.provider || "Unknown");
      setLastError(res.data?.last_error || null);
    } catch (e) {
      setConfigured(false);
      setProvider("Unknown");
    }
  }

  async function handleTestEmail() {
    if (!testEmail) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke("sendNotifications", {
        action: "sendEmail",
        to: testEmail,
        subject: "Test Email from Frontier Selections",
        body: "This is a test email to verify your email configuration is working correctly.",
        from_name: "Frontier Building Group"
      });
      if (res.data?.email_sent) {
        setTestResult({ success: true, message: "Test email sent successfully!" });
      } else {
        setTestResult({ success: false, message: res.data?.error || res.data?.reason || "Email sending failed" });
      }
    } catch (e) {
      setTestResult({ success: false, message: e.message || "Failed to send test email" });
    }
    setTesting(false);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure and test email sending for customer invitations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail size={20} /> Email Configuration Status
          </CardTitle>
          <CardDescription>Current email sending configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {configured === true ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : configured === false ? (
              <XCircle size={20} className="text-red-600" />
            ) : (
              <Loader2 size={20} className="animate-spin text-gray-400" />
            )}
            <div>
              <p className="font-medium">
                {configured === true ? "Email configured: Yes" : configured === false ? "Email configured: No" : "Checking..."}
              </p>
              <p className="text-sm text-gray-500">Sending provider: {provider}</p>
            </div>
          </div>

          {lastError && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">{lastError}</AlertDescription>
            </Alert>
          )}

          {!configured && (
            <Alert>
              <AlertDescription className="text-sm">
                <strong>To enable email sending:</strong>
                <ol className="list-de list-inside mt-2 space-y-1">
                  <li>Go to Base44 Dashboard → Settings → Secrets</li>
                  <li>Add a new secret named <code className="bg-gray-100 px-2 py-0.5 rounded">EMAIL_API_KEY</code></li>
                  <li>Enter your Resend API key (or other provider key)</li>
                  <li>Save the secret and refresh this page</li>
                </ol>
                <p className="mt-3 text-xs text-gray-500">
                  Get a Resend API key at <a href="https://resend.com" target="_blank" className="underline">resend.com</a>
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Email Sending</CardTitle>
          <CardDescription>Send a test email to verify configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="test-email">Test Email Address</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1"
              />
              <Button onClick={handleTestEmail} disabled={testing || !testEmail}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {testing ? "Sending..." : "Send Test"}
              </Button>
            </div>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <AlertDescription className="text-sm">{testResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Email Sending Works</CardTitle>
          <CardDescription>Understanding the email configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Customer invitations can be sent via email when the <code className="bg-gray-100 px-1.5 py-0.5 rounded">EMAIL_API_KEY</code> secret is configured.
          </p>
          <p>
            If email is not configured, invitations are still created successfully. Staff can copy the secure invite link and send it manually to customers.
          </p>
          <p>
            All email sending attempts (successful or failed) are logged in the Audit Log for tracking purposes.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
            <p className="font-medium text-blue-800">Current Provider: Resend</p>
            <p className="text-xs text-blue-600 mt-1">
              The app uses Resend.com for email delivery. You'll need a verified domain or use the default onboarding@resend.dev sender.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}