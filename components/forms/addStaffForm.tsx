// components/forms/AddStaffForm.tsx
//
// Changes:
// - Import and apply the SAME strong password validator used at signup.
// - Show clear inline help if the password is too weak.
// - No API shape changes: still POSTs to /api/staff/add with name/email/password/isAdmin/businessId.
//
// Why: keep logic simple and safe. Server validates again (defense-in-depth).

"use client";

import ButtonWithSpinner from "../ui/buttonWithSpinner";
import { useState, FormEvent, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { isStrongPassword } from "@/lib/validator"; // ✅ re-use same rule

function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

function isAllowedDomain(candidate: string | null, businessDomain: string | null): boolean {
  if (!candidate || !businessDomain) return false;
  if (candidate === businessDomain) return true;
  return candidate.endsWith("." + businessDomain);
}

interface AddStaffFormProps {
  onSuccess?: () => void;
}

export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Domain-related state
  const [effectiveDomain, setEffectiveDomain] = useState<string | null>(null);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // Fetch the effective business domain on mount
  useEffect(() => {
    const fetchDomain = async () => {
      setDomainLoading(true);
      setDomainError(null);
      try {
        const res = await fetch("/api/business/domain");
        const data = await res.json();
        if (!res.ok) {
          setEffectiveDomain(null);
          setDomainError(data.error || "Unable to resolve business domain");
        } else {
          setEffectiveDomain((data.domain || "").toLowerCase());
        }
      } catch (err) {
        console.error("[AddStaffForm] Failed to load business domain:", err);
        setDomainError("Network error resolving business domain");
      } finally {
        setDomainLoading(false);
      }
    };

    if (session?.user?.businessId) {
      fetchDomain();
    } else {
      setEffectiveDomain(null);
      setDomainError("No business assigned to your account");
    }
  }, [session?.user?.businessId]);

  // Compute candidate domain from the email input
  const candidateDomain = useMemo(() => extractDomain(email), [email]);

  // Validate domain + password client-side for good UX
  const emailDomainValid = useMemo(() => {
    if (!effectiveDomain) return false;
    return isAllowedDomain(candidateDomain, effectiveDomain);
  }, [candidateDomain, effectiveDomain]);

  const passwordStrong = useMemo(() => isStrongPassword(password), [password]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const businessId = session?.user?.businessId;
    if (!businessId) {
      toast.error("You must belong to a business to add staff.");
      return;
    }
    if (!effectiveDomain) {
      toast.error("Business domain is not ready yet. Please try again.");
      return;
    }
    if (!emailDomainValid) {
      toast.error(`Email must use your company domain: @${effectiveDomain} (or a subdomain).`);
      return;
    }
    if (!passwordStrong) {
      toast.error(
        "Default password must be 8+ chars and include uppercase, lowercase, number, and special character."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // BusinessId is validated server-side too
        body: JSON.stringify({ name, email: email.toLowerCase(), password, isAdmin, businessId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error adding staff");
        return;
      }

      if (data.checkoutUrl) {
        // Paid seat flow → redirect to Stripe
        window.location.href = data.checkoutUrl;
        return;
      }

      // Free seat flow
      toast.success("🎉 Staff created successfully.");
      setName("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("[AddStaffForm] Unexpected error:", error);
      toast.error("Internal error, please try again.");
    } finally {
      setLoading(false);
    }
  };

  const emailHelpText = useMemo(() => {
    if (domainLoading) return "Resolving your company domain...";
    if (domainError) return domainError;
    if (!effectiveDomain) return "Enter an email — domain rules will appear here.";
    if (!email) return `Only @${effectiveDomain} or subdomains (e.g., team.${effectiveDomain}) are allowed.`;
    return emailDomainValid
      ? `✔ Allowed: matches @${effectiveDomain} or a subdomain.`
      : `✖ Invalid: must use @${effectiveDomain} or a subdomain (e.g., team.${effectiveDomain}).`;
  }, [domainLoading, domainError, effectiveDomain, email, emailDomainValid]);

  const passwordHelpText = useMemo(() => {
    if (!password) return "Set a default password. The staff member will be forced to change it on first login.";
    return passwordStrong
      ? "✔ Strong password."
      : "✖ Must be 8+ chars and include uppercase, lowercase, number, and special character.";
  }, [password, passwordStrong]);

  const submitDisabled =
    loading ||
    domainLoading ||
    !effectiveDomain ||
    !emailDomainValid ||
    !passwordStrong;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* Staff Name */}
      <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
        Name
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Staff full name"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* Staff Email */}
      <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="staff@business.com"
        className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
          ${email && effectiveDomain
            ? emailDomainValid
              ? "border-green-400"
              : "border-red-400"
            : "border-white"
          }`}
      />
      <p
        className={`text-xs ${
          email && effectiveDomain
            ? emailDomainValid
              ? "text-green-200"
              : "text-red-200"
            : "text-white/80"
        }`}
      >
        {emailHelpText}
      </p>

      {/* Default Password */}
      <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
        Default Password (staff will change this on first login)
      </label>
      <div className="relative">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter password"
          className={`block w-full border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white
            ${password ? (passwordStrong ? "border-green-400" : "border-red-400") : "border-white"}`}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline cursor-pointer"
          tabIndex={-1}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      <p className={`text-xs ${password ? (passwordStrong ? "text-green-200" : "text-red-200") : "text-white/80"}`}>
        {passwordHelpText}
      </p>

      {/* Make Admin Option */}
      <div className="flex items-center gap-2 mt-2 relative">
        <input
          id="isAdmin"
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
          className="w-5 h-5 cursor-pointer"
        />
        <label htmlFor="isAdmin" className="text-white text-sm md:text-base cursor-pointer">
          Make this staff member an Admin
        </label>

        <button
          type="button"
          onClick={() => setShowInfo((prev) => !prev)}
          className="ml-2 text-white hover:text-blue-300 font-bold cursor-pointer"
          aria-label="What is an admin?"
        >
          ℹ️
        </button>

        {showInfo && (
          <div className="absolute top-8 left-0 bg-white text-black text-sm rounded-lg shadow-md p-3 w-64 z-10">
            <p>
              Admins have elevated permissions. They can manage staff, view billing,
              and perform administrative tasks for the business.
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <ButtonWithSpinner type="submit" loading={loading} disabled={submitDisabled}>
        {loading ? "Adding Staff..." : "Add Staff"}
      </ButtonWithSpinner>
    </form>
  );
}
