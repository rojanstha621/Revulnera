// src/pages/Register.jsx
import React, { useState, useContext, useEffect } from "react";
import { postJSON } from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { emitErrorToast } from "../utils/errorUtils";

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    password2: "",
  });

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const { isAuthenticated } = useContext(AuthContext);
  const nav = useNavigate();

  useEffect(() => {
    if (isAuthenticated) nav("/");
  }, [isAuthenticated, nav]);

  useEffect(() => {
    if (!showPrivacyModal) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowPrivacyModal(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPrivacyModal]);

  const onChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    const email = form.email.trim();
    const full_name = form.full_name.trim();

    if (!email.includes("@")) {
      setErr("Please enter a valid email address.");
      emitErrorToast("Please enter a valid email address.");
      return;
    }
    if (form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      emitErrorToast("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.password2) {
      setErr("Passwords do not match.");
      emitErrorToast("Passwords do not match.");
      return;
    }
    if (!acceptedPrivacyPolicy) {
      setErr("You must accept the Privacy Policy before registration.");
      emitErrorToast("You must accept the Privacy Policy before registration.");
      return;
    }

    setLoading(true);
    const res = await postJSON("/auth/register/", {
      email,
      password: form.password,
      full_name,
    });
    setLoading(false);

    // RegisterView returns created user or standard DRF output.
    // Even if response is minimal, we treat success as HTTP 201 -> your postJSON likely returns JSON.
    if (res?.id || res?.email) {
      setMsg("Registration successful. Check your email to verify your account.");
      setForm({ email: "", password: "", full_name: "", password2: "" });
      setAcceptedPrivacyPolicy(false);
      return;
    }

    const message = res?.detail || "Registration error. Please try again.";
    setErr(message);
    emitErrorToast(message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-white">Create an account</h2>
        <p className="text-sm text-slate-300 mb-4">
          Sign up to start running scans and reviewing reports.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            required
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="Email"
            type="email"
            className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
          />

          <input
            required
            name="full_name"
            value={form.full_name}
            onChange={onChange}
            placeholder="Full name"
            className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
          />

          <input
            required
            name="password"
            value={form.password}
            onChange={onChange}
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
          />

          <input
            required
            name="password2"
            value={form.password2}
            onChange={onChange}
            type="password"
            placeholder="Confirm password"
            className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-cyan-500/30"
          />

          <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
            <label className="flex items-start gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={acceptedPrivacyPolicy}
                onChange={(e) => setAcceptedPrivacyPolicy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
              />
              <span>I have read and agree to the Privacy Policy.</span>
            </label>
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="mt-2 text-sm text-cyan-300 underline"
            >
              Read Privacy Policy
            </button>
          </div>

          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
        {msg && (
          <div className="mt-4 text-sm text-green-400">
            <p>{msg}</p>
            <p className="mt-2 text-slate-300">
              You can also{" "}
              <Link to="/auth/login" className="text-cyan-300 underline">
                sign in
              </Link>{" "}
              after verification.
            </p>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-300">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-cyan-300 underline">
            Sign in
          </Link>
        </p>
      </div>

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-lg font-semibold text-white">Privacy Policy</h3>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-sm text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-4 text-sm text-slate-200">
              <p className="text-xs text-slate-400">Effective Date: April 7, 2026</p>
              <p className="text-xs text-slate-400">Last Updated: April 7, 2026</p>

              <p>
                Revulnera ("we," "our," or "us") provides a security reconnaissance and vulnerability analysis platform through a web
                application and related services (the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect
                personal data when you use the Service.
              </p>

              <p>By using the Service, you agree to this Privacy Policy.</p>

              <section>
                <h4 className="font-semibold text-white">1. Scope</h4>
                <p>This Privacy Policy applies to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Our frontend web application</li>
                  <li>Our backend APIs and WebSocket services</li>
                  <li>Our scanner and analysis pipelines</li>
                  <li>Related administrative workflows, including KYC and account approvals</li>
                </ul>
                <p className="mt-2">This Privacy Policy does not apply to third-party websites, tools, or services we do not control.</p>
              </section>

              <section>
                <h4 className="font-semibold text-white">2. Data We Collect</h4>
                <p>We may collect the following categories of data:</p>
                <p className="mt-2 font-medium text-white">2.1 Account and Identity Data</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Name, username, email address, and account credentials</li>
                  <li>Role and permission data (for example, admin/user flags)</li>
                  <li>Authentication session and token metadata</li>
                </ul>
                <p className="mt-2 font-medium text-white">2.2 KYC and Compliance Data</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Identity verification documents uploaded by users</li>
                  <li>KYC review and approval status</li>
                  <li>Administrative review notes or decision metadata</li>
                </ul>
                <p className="mt-2 font-medium text-white">2.3 Scan Input and Security Assessment Data</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Target domains, subdomains, endpoints, and related scan parameters</li>
                  <li>Optional authentication context supplied for testing (for example, headers or cookies)</li>
                  <li>Scan job metadata, timing, and status</li>
                </ul>
                <p className="mt-2 font-medium text-white">2.4 Scan Output and Findings Data</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Reconnaissance results (subdomains, hosts, endpoints)</li>
                  <li>Network findings (ports, TLS configuration, directory exposure checks)</li>
                  <li>Vulnerability findings, logs, and related evidence generated by OWASP-oriented checks</li>
                </ul>
                <p className="mt-2 font-medium text-white">2.5 Technical and Usage Data</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>API request metadata (for example, IP address, timestamps, user agent)</li>
                  <li>Application logs, error traces, and performance diagnostics</li>
                  <li>Device/browser-level data used for security and reliability</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold text-white">3. How We Use Data</h4>
                <p>We process data to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide, operate, and maintain the Service</li>
                  <li>Authenticate users and enforce role-based access controls</li>
                  <li>Run scans and generate reporting outputs requested by users</li>
                  <li>Process KYC submissions and compliance workflows</li>
                  <li>Prevent abuse, fraud, unauthorized access, and misuse</li>
                  <li>Troubleshoot issues, monitor performance, and improve reliability</li>
                  <li>Comply with legal obligations and enforce our terms</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold text-white">4. Legal Basis (Where Applicable)</h4>
                <p>Where data protection laws such as GDPR apply, we rely on one or more of the following legal bases:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Performance of a contract (providing requested services)</li>
                  <li>Legitimate interests (platform security, abuse prevention, service improvement)</li>
                  <li>Compliance with legal obligations</li>
                  <li>Consent, where required by law</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold text-white">5. Sharing and Disclosure</h4>
                <p>We do not sell personal data.</p>
                <p className="mt-2">We may share data with:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Service providers and infrastructure partners that host or support the Service</li>
                  <li>Security, legal, or regulatory authorities when required by law</li>
                  <li>Professional advisers (legal, audit, compliance) under confidentiality obligations</li>
                </ul>
                <p className="mt-2">We may disclose data if necessary to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Protect users, our systems, or the public</li>
                  <li>Investigate abuse, fraud, or security incidents</li>
                  <li>Enforce our agreements and legal rights</li>
                </ul>
              </section>

              <section>
                <h4 className="font-semibold text-white">6. International Data Transfers</h4>
                <p>
                  Your data may be processed in countries other than your own. Where required, we implement safeguards appropriate to
                  applicable law for cross-border data transfers.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-white">7. Data Retention</h4>
                <p>
                  We retain data only as long as necessary for the purposes described in this Privacy Policy, including legal, accounting,
                  and security requirements.
                </p>
                <p className="mt-2">Indicative retention windows (unless a longer period is legally required):</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Account profile data: while account is active and for up to 12 months after deletion request</li>
                  <li>KYC documents: for up to 24 months after verification decision or account closure</li>
                  <li>Scan metadata and findings: up to 24 months, configurable by operational policy</li>
                  <li>Security and audit logs: typically 90 to 365 days</li>
                </ul>
                <p className="mt-2">We may anonymize or aggregate data for analytics and product improvement.</p>
              </section>

              <section>
                <h4 className="font-semibold text-white">8. Security</h4>
                <p>
                  We use reasonable administrative, technical, and organizational safeguards designed to protect personal data, including
                  access controls and secured storage for sensitive files (such as private KYC uploads).
                </p>
                <p className="mt-2">
                  No method of transmission or storage is completely secure. You are responsible for keeping your credentials confidential
                  and notifying us of suspected unauthorized access.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-white">9. User Responsibilities for Scanning</h4>
                <p>
                  You are responsible for ensuring you have authorization to scan any target you submit. Do not submit targets or
                  credentials without legal permission.
                </p>
                <p className="mt-2">We are not responsible for unlawful or unauthorized scanning activity initiated by users.</p>
              </section>

              <section>
                <h4 className="font-semibold text-white">10. Your Privacy Rights</h4>
                <p>Depending on your jurisdiction, you may have rights to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Access personal data we hold about you</li>
                  <li>Correct inaccurate or incomplete data</li>
                  <li>Delete personal data (subject to legal exceptions)</li>
                  <li>Restrict or object to certain processing</li>
                  <li>Request data portability</li>
                  <li>Withdraw consent where processing is consent-based</li>
                </ul>
                <p className="mt-2">To exercise rights, contact us at: [privacy@yourdomain.com]</p>
                <p className="mt-2">We may need to verify your identity before processing your request.</p>
              </section>

              <section>
                <h4 className="font-semibold text-white">11. Cookies and Similar Technologies</h4>
                <p>
                  The Service may use cookies, local storage, and similar technologies for authentication, session management, and user
                  experience.
                </p>
                <p className="mt-2">
                  You can control cookies through your browser settings, but disabling some controls may affect Service functionality.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-white">12. Children's Privacy</h4>
                <p>
                  The Service is not directed to children under the age required by applicable law in your jurisdiction. We do not knowingly
                  collect personal data from children without required legal basis.
                </p>
              </section>

              <section>
                <h4 className="font-semibold text-white">13. Changes to This Privacy Policy</h4>
                <p>
                  We may update this Privacy Policy from time to time. If changes are material, we will provide appropriate notice through
                  the Service or by other means.
                </p>
                <p className="mt-2">The "Last Updated" date indicates the latest revision.</p>
              </section>

              <section>
                <h4 className="font-semibold text-white">14. Contact</h4>
                <p>Data Controller / Company Name: [Revulnera / Legal Entity Name]</p>
                <p className="mt-1">Email: [privacy@yourdomain.com]</p>
                <p className="mt-1">Address: [Your Business Address]</p>
                <p className="mt-2">
                  If you are in a jurisdiction with a data protection authority, you may also have the right to lodge a complaint with that
                  authority.
                </p>
              </section>

              <p className="text-xs text-slate-400">
                This template is provided for operational use and should be reviewed by qualified legal counsel to ensure compliance with
                the laws that apply to your business and users.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcceptedPrivacyPolicy(true);
                  setShowPrivacyModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700"
              >
                I Agree and Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
