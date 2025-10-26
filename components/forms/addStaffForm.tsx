// components/forms/addStaffForm.tsx
//
// Purpose
// -------
// Old add-staff UI restored (with Admin checkbox). No dropdown.
// Strong password & domain hints remain for great UX.
//
// Flow (unchanged intent)
// -----------------------
// 1) Create the staff user via /api/staff/create (server enforces domain & role).
// 2) Start a Stripe Checkout Session for ONE staff seat via /api/staff/add,
//    passing `staffEmail` so the webhook persists the *staff* identity onto
//    Payment.description. Billing then shows the staff user in the "User" column.
//
// Why this fixes your symptoms
// ---------------------------
// • The missing /api/staff/create route caused a 404, returning HTML → client
//   tried to parse JSON → "Unexpected token '<'". With the route added, the form
//   works and the error disappears.
// • By passing `staffEmail` to /api/staff/add` (as we already do), Staff Seat rows
//   in Billing show the *staff* (not the owner).
//
// Pillars
// -------
// - Efficiency: single create + single add-seat call; minimal round trips.
// - Robustness: strict client checks + server validation; clear toasts.
// - Simplicity: checkbox for admin; no dropdown.
// - Security: password never sent anywhere else; server hashes & enforces domain.

"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

// --- Small helpers copied from your earlier UI for clarity ---
function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}
function isAllowedDomain(candidate: string | null, base: string | null): boolean {
  if (!candidate || !base) return false;
  if (candidate === base) return true;
  return candidate.endsWith("." + base);
}
function isStrongPassword(pw: string): boolean {
  // 8+ chars incl. upper, lower, digit, special
  return /[a-z]/.test(pw) &&
         /[A-Z]/.test(pw) &&
         /\d/.test(pw) &&
         /[^A-Za-z0-9]/.test(pw) &&
         pw.length >= 8;
}

export default function AddStaffForm() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Domain banner (UX hint only; server still enforces)
  const [effectiveDomain, setEffectiveDomain] = useState<string | null>(null);
  const [displayLabel, setDisplayLabel] = useState<string | null>(null);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  // 1) Fetch the effective business domain (for hints)
  useEffect(() => {
    const fetchDomain = async () => {
      setDomainLoading(true);
      setDomainError(null);
      try {
        const res = await fetch("/api/business/domain");
        const data = await res.json();
        if (!res.ok) {
          setEffectiveDomain(null);
          setDisplayLabel(null);
          setDomainError(data.error || "Unable to resolve business domain");
        } else {
          setEffectiveDomain((data.domain || "").toLowerCase());
          setDisplayLabel((data.display || data.domain || "").toLowerCase());
        }
      } catch (err) {
        setDomainError("Network error resolving business domain");
        setEffectiveDomain(null);
        setDisplayLabel(null);
      } finally {
        setDomainLoading(false);
      }
    };

    if (session?.user?.businessId) {
      fetchDomain();
    } else {
      setEffectiveDomain(null);
      setDisplayLabel(null);
      setDomainError("No business assigned to your account");
    }
  }, [session?.user?.businessId]);

  // 2) Derived validations (client-side UX only)
  const candidateDomain = useMemo(() => extractDomain(email), [email]);
  const emailDomainValid = useMemo(
    () => isAllowedDomain(candidateDomain, effectiveDomain),
    [candidateDomain, effectiveDomain]
  );
  const passwordStrong = useMemo(() => isStrongPassword(defaultPassword), [defaultPassword]);

  const emailHelpText = useMemo(() => {
    if (domainLoading) return "Resolving your company domain...";
    if (domainError) return domainError;
    if (!effectiveDomain) return "Enter an email — domain rules will appear here.";
    if (!email) return `Only @${displayLabel || effectiveDomain} or subdomains (e.g., team.${effectiveDomain}) are allowed.`;
    return emailDomainValid
      ? `✔ Allowed: matches @${displayLabel || effectiveDomain} or a subdomain.`
      : `✖ Invalid: must use @${displayLabel || effectiveDomain} or a subdomain (e.g., team.${effectiveDomain}).`;
  }, [domainLoading, domainError, effectiveDomain, displayLabel, email, emailDomainValid]);

  const passwordHelpText = useMemo(() => {
    if (!defaultPassword) return "Set a default password. The staff member will be forced to change it on first login.";
    return passwordStrong
      ? "✔ Strong password."
      : "✖ Must be 8+ chars and include uppercase, lowercase, number, and special character.";
  }, [defaultPassword, passwordStrong]);

  const submitDisabled =
    loading ||
    domainLoading ||
    !effectiveDomain ||
    !emailDomainValid ||
    !passwordStrong;

  // 3) Submit (create → add seat)
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!session?.user?.businessId) {
      toast.error("You must belong to a business to add staff.");
      return;
    }
    if (!effectiveDomain) {
      toast.error("Business domain is not ready yet. Please try again.");
      return;
    }
    if (!emailDomainValid) {
      toast.error(`Email must use your company domain: @${displayLabel || effectiveDomain} (or a subdomain).`);
      return;
    }
    if (!passwordStrong) {
      toast.error("Default password is not strong enough.");
      return;
    }

    setLoading(true);
    try {
      // 3a) Create the staff user (server validates domain & hashes password)
      const createRes = await fetch("/api/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          defaultPassword: defaultPassword.trim(),
          role: isAdmin ? "ADMIN" : "USER",
          name: name.trim(),
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        toast.error(createData.error || "Failed to create staff user");
        setLoading(false);
        return;
      }

      // 3b) Start a Checkout session for one staff seat.
      //     NOTE: We send staffEmail so Billing shows the *staff* identity.
      const addSeatRes = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffEmail: email.toLowerCase().trim(),
        }),
      });
      const addSeatData = await addSeatRes.json();

      if (!addSeatRes.ok) {
        toast.error(addSeatData.error || "Failed to start checkout");
        setLoading(false);
        return;
      }

      // If no payment needed (free seat window)
      if (addSeatData.requiresPayment === false) {
        toast.success(`✅ Added ${email}`);
        window.location.href = "/dashboard/staff";
        return;
      }

      // 3c) Redirect to Stripe
      if (addSeatData.checkoutUrl) {
        window.location.href = addSeatData.checkoutUrl as string;
      } else {
        toast.error("Missing checkout URL");
        setLoading(false);
      }
    } catch (err) {
      console.error("[AddStaffForm] submit error:", err);
      toast.error("Unexpected error adding staff");
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
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
        placeholder={`staff@${effectiveDomain || "business.com"}`}
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
      <label htmlFor="defaultPassword" className="text-white font-bold text-sm md:text-base">
        Default Password (staff will change this on first login)
      </label>
      <div className="relative">
        <input
          id="defaultPassword"
          type={showPassword ? "text" : "password"}
          value={defaultPassword}
          onChange={(e) => setDefaultPassword(e.target.value)}
          required
          placeholder="Enter password"
          className={`block w-full border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white
            ${defaultPassword ? (passwordStrong ? "border-green-400" : "border-red-400") : "border-white"}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline cursor-pointer"
          tabIndex={-1}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      <p className={`text-xs ${defaultPassword ? (passwordStrong ? "text-green-200" : "text-red-200") : "text-white/80"}`}>
        {passwordHelpText}
      </p>

      {/* Make Admin Option (checkbox only) */}
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
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitDisabled}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded disabled:opacity-50 mt-2"
      >
        {loading ? "Adding Staff..." : "Add Staff"}
      </button>
    </form>
  );
}









// // components/forms/addStaffForm.tsx
// //
// // Purpose
// // -------
// // Form used by Business Owner/Admin to add a staff account, then pay for a seat.
// //
// // 🔧 Fixes applied (tiny, focused):
// // 1) After creating the staff user (same as before), we ALWAYS pass the staff's email
// //    to /api/staff/add as { staffEmail }. The /api/staff/add route persists a
// //    structured description ("STAFF_SEAT:<email>") to Stripe metadata so the webhook
// //    stores it into Payment.description. Billing then displays the *staff* identity
// //    (not the owner) for Staff Seat rows.
// // 2) Creating the staff FIRST (before opening Checkout) guarantees the user exists
// //    when we return from Stripe — so the Staff page (which lists active users) shows
// //    the new staff immediately after success.
// //
// // Pillars
// // -------
// // - Efficiency: minimal extra data (just the email string) sent once.
// // - Robustness: strict field checks; clean error toasts.
// // - Simplicity: single responsibility per call (create → checkout).
// // - Security: server routes still validate ownership/domain/role.

// "use client";

// import { useState } from "react";
// import toast from "react-hot-toast";

// export default function AddStaffForm() {
//   const [email, setEmail] = useState("");
//   const [defaultPassword, setDefaultPassword] = useState("");
//   const [role, setRole] = useState<"USER" | "ADMIN">("USER");
//   const [loading, setLoading] = useState(false);

//   const onSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!email || !defaultPassword) {
//       toast.error("Email and default password are required");
//       return;
//     }

//     setLoading(true);
//     try {
//       // 1) Create the staff user first (server enforces domain/role, sets isActive, etc.)
//       const createRes = await fetch("/api/staff/create", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           email: email.trim(),
//           defaultPassword: defaultPassword.trim(),
//           role, // "USER" | "ADMIN"
//         }),
//       });
//       const createData = await createRes.json();
//       if (!createRes.ok) {
//         toast.error(createData.error || "Failed to create staff user");
//         setLoading(false);
//         return;
//       }

//       // 2) Request a Stripe Checkout Session for ONE staff seat.
//       //    ✅ CRITICAL: pass staffEmail so billing shows the staff identity.
//       const addSeatRes = await fetch("/api/staff/add", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           staffEmail: email.trim(),   // <-- the key part of this fix
//           // pricePerStaff is optional; server prefers env price. Keep omitted
//           // to avoid accidental client price control.
//         }),
//       });
//       const addSeatData = await addSeatRes.json();
//       if (!addSeatRes.ok) {
//         toast.error(addSeatData.error || "Failed to start checkout");
//         setLoading(false);
//         return;
//       }

//       // If payment not required (free seat window), just refresh Staff page
//       if (addSeatData.requiresPayment === false) {
//         toast.success(`✅ Added ${email}`);
//         window.location.href = "/dashboard/staff";
//         return;
//       }

//       // 3) Redirect user to Stripe checkout
//       if (addSeatData.checkoutUrl) {
//         window.location.href = addSeatData.checkoutUrl as string;
//       } else {
//         toast.error("Missing checkout URL");
//         setLoading(false);
//       }
//     } catch (err) {
//       console.error("[AddStaffForm] submit error:", err);
//       toast.error("Unexpected error adding staff");
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={onSubmit}
//       className="w-[90%] sm:w-[600px] md:w-[700px] bg-white rounded-xl shadow p-6 space-y-4"
//     >
//       <div>
//         <label className="block text-sm font-medium text-gray-700">
//           Staff Email
//         </label>
//         <input
//           type="email"
//           required
//           value={email}
//           onChange={(e) => setEmail(e.target.value)}
//           className="mt-1 w-full border rounded px-3 py-2"
//           placeholder="name@yourcompany.com"
//         />
//       </div>

//       <div>
//         <label className="block text-sm font-medium text-gray-700">
//           Default Password
//         </label>
//         <input
//           type="password"
//           required
//           value={defaultPassword}
//           onChange={(e) => setDefaultPassword(e.target.value)}
//           className="mt-1 w-full border rounded px-3 py-2"
//           placeholder="Temporary password"
//         />
//         <p className="text-xs text-gray-500 mt-1">
//           They’ll be required to change this at first login.
//         </p>
//       </div>

//       <div>
//         <label className="block text-sm font-medium text-gray-700">
//           Role
//         </label>
//         <select
//           value={role}
//           onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
//           className="mt-1 w-full border rounded px-3 py-2"
//         >
//           <option value="USER">Staff (User)</option>
//           <option value="ADMIN">Staff (Admin)</option>
//         </select>
//       </div>

//       <button
//         type="submit"
//         disabled={loading}
//         className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded disabled:opacity-50"
//       >
//         {loading ? "Adding…" : "Add Staff"}
//       </button>
//     </form>
//   );
// }









// // components/forms/AddStaffForm.tsx
// //
// // Changes in this patch (UI-only):
// // - Use the new /api/business/domain endpoint to get both:
// //     • domain  → real validation target (e.g., "health.gov.au")
// //     • display → user-friendly cue (e.g., "health")
// // - Keep validation EXACTLY the same (same/seb-domain of `domain`).
// // - Keep responses and submit shape the same.
// // - No behavior change besides the wording/UI clarity.

// "use client";

// import ButtonWithSpinner from "../ui/buttonWithSpinner";
// import { useState, FormEvent, useEffect, useMemo } from "react";
// import { useSession } from "next-auth/react";
// import toast from "react-hot-toast";
// import { isStrongPassword } from "@/lib/validator";

// function extractDomain(email: string | null | undefined): string | null {
//   if (!email) return null;
//   const at = email.lastIndexOf("@");
//   if (at < 0 || at === email.length - 1) return null;
//   return email.slice(at + 1).toLowerCase().trim();
// }

// function isAllowedDomain(candidate: string | null, businessDomain: string | null): boolean {
//   if (!candidate || !businessDomain) return false;
//   if (candidate === businessDomain) return true;
//   return candidate.endsWith("." + businessDomain);
// }

// interface AddStaffFormProps {
//   onSuccess?: () => void;
// }

// export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
//   const { data: session } = useSession();
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [isAdmin, setIsAdmin] = useState(false);
//   const [showInfo, setShowInfo] = useState(false);

//   // Domain-related state (now includes display)
//   const [effectiveDomain, setEffectiveDomain] = useState<string | null>(null);
//   const [displayLabel, setDisplayLabel] = useState<string | null>(null);
//   const [domainLoading, setDomainLoading] = useState(false);
//   const [domainError, setDomainError] = useState<string | null>(null);

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // Fetch the effective business domain on mount
//   useEffect(() => {
//     const fetchDomain = async () => {
//       setDomainLoading(true);
//       setDomainError(null);
//       try {
//         const res = await fetch("/api/business/domain");
//         const data = await res.json();
//         if (!res.ok) {
//           setEffectiveDomain(null);
//           setDisplayLabel(null);
//           setDomainError(data.error || "Unable to resolve business domain");
//         } else {
//           setEffectiveDomain((data.domain || "").toLowerCase());
//           setDisplayLabel((data.display || "").toLowerCase());
//         }
//       } catch (err) {
//         console.error("[AddStaffForm] Failed to load business domain:", err);
//         setDomainError("Network error resolving business domain");
//       } finally {
//         setDomainLoading(false);
//       }
//     };

//     if (session?.user?.businessId) {
//       fetchDomain();
//     } else {
//       setEffectiveDomain(null);
//       setDisplayLabel(null);
//       setDomainError("No business assigned to your account");
//     }
//   }, [session?.user?.businessId]);

//   // Compute candidate domain from the email input
//   const candidateDomain = useMemo(() => extractDomain(email), [email]);

//   // Validate domain + password client-side for good UX (unchanged logic)
//   const emailDomainValid = useMemo(() => {
//     if (!effectiveDomain) return false;
//     return isAllowedDomain(candidateDomain, effectiveDomain);
//   }, [candidateDomain, effectiveDomain]);

//   const passwordStrong = useMemo(() => isStrongPassword(password), [password]);

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     const businessId = session?.user?.businessId;
//     if (!businessId) {
//       toast.error("You must belong to a business to add staff.");
//       return;
//     }
//     if (!effectiveDomain) {
//       toast.error("Business domain is not ready yet. Please try again.");
//       return;
//     }
//     if (!emailDomainValid) {
//       toast.error(`Email must use your company domain: @${displayLabel || effectiveDomain} (or a subdomain).`);
//       return;
//     }
//     if (!passwordStrong) {
//       toast.error(
//         "Default password must be 8+ chars and include uppercase, lowercase, number, and special character."
//       );
//       return;
//     }

//     setLoading(true);
//     try {
//       const res = await fetch("/api/staff/add", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, email: email.toLowerCase(), password, isAdmin, businessId, pricePerStaff:  Number(process.env.NEXT_PUBLIC_STAFF_SEAT_PRICE || "20") }),
//       });

//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data.error || "Error adding staff");
//         return;
//       }

//       if (data.checkoutUrl) {
//         // Paid seat flow → redirect to Stripe
//         window.location.href = data.checkoutUrl;
//         return;
//       }

//       // Free seat flow
//       toast.success("🎉 Staff created successfully.");
//       setName("");
//       setEmail("");
//       setPassword("");
//       setIsAdmin(false);
//       if (onSuccess) onSuccess();
//     } catch (error) {
//       console.error("[AddStaffForm] Unexpected error:", error);
//       toast.error("Internal error, please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const emailHelpText = useMemo(() => {
//     if (domainLoading) return "Resolving your company domain...";
//     if (domainError) return domainError;
//     if (!effectiveDomain) return "Enter an email — domain rules will appear here.";
//     if (!email) return `Only @${displayLabel || effectiveDomain} or subdomains (e.g., team.${effectiveDomain}) are allowed.`;
//     return emailDomainValid
//       ? `✔ Allowed: matches @${displayLabel || effectiveDomain} or a subdomain.`
//       : `✖ Invalid: must use @${displayLabel || effectiveDomain} or a subdomain (e.g., team.${effectiveDomain}).`;
//   }, [domainLoading, domainError, effectiveDomain, displayLabel, email, emailDomainValid]);

//   const passwordHelpText = useMemo(() => {
//     if (!password) return "Set a default password. The staff member will be forced to change it on first login.";
//     return passwordStrong
//       ? "✔ Strong password."
//       : "✖ Must be 8+ chars and include uppercase, lowercase, number, and special character.";
//   }, [password, passwordStrong]);

//   const submitDisabled =
//     loading ||
//     domainLoading ||
//     !effectiveDomain ||
//     !emailDomainValid ||
//     !passwordStrong;

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Staff Name */}
//       <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
//         Name
//       </label>
//       <input
//         id="name"
//         type="text"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         required
//         placeholder="Staff full name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Staff Email */}
//       <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         id="email"
//         type="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         placeholder={`staff@${effectiveDomain || "business.com"}`}
//         className={`block w-full border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white
//           ${email && effectiveDomain
//             ? emailDomainValid
//               ? "border-green-400"
//               : "border-red-400"
//             : "border-white"
//           }`}
//       />
//       <p
//         className={`text-xs ${
//           email && effectiveDomain
//             ? emailDomainValid
//               ? "text-green-200"
//               : "text-red-200"
//             : "text-white/80"
//         }`}
//       >
//         {emailHelpText}
//       </p>

//       {/* Default Password */}
//       <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
//         Default Password (staff will change this on first login)
//       </label>
//       <div className="relative">
//         <input
//           id="password"
//           type={showPassword ? "text" : "password"}
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           placeholder="Enter password"
//           className={`block w-full border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white
//             ${password ? (passwordStrong ? "border-green-400" : "border-red-400") : "border-white"}`}
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline cursor-pointer"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>
//       <p className={`text-xs ${password ? (passwordStrong ? "text-green-200" : "text-red-200") : "text-white/80"}`}>
//         {passwordHelpText}
//       </p>

//       {/* Make Admin Option */}
//       <div className="flex items-center gap-2 mt-2 relative">
//         <input
//           id="isAdmin"
//           type="checkbox"
//           checked={isAdmin}
//           onChange={(e) => setIsAdmin(e.target.checked)}
//           className="w-5 h-5 cursor-pointer"
//         />
//         <label htmlFor="isAdmin" className="text-white text-sm md:text-base cursor-pointer">
//           Make this staff member an Admin
//         </label>

//         <button
//           type="button"
//           onClick={() => setShowInfo((prev) => !prev)}
//           className="ml-2 text-white hover:text-blue-300 font-bold cursor-pointer"
//           aria-label="What is an admin?"
//         >
//           ℹ️
//         </button>

//         {showInfo && (
//           <div className="absolute top-8 left-0 bg-white text-black text-sm rounded-lg shadow-md p-3 w-64 z-10">
//             <p>
//               Admins have elevated permissions. They can manage staff, view billing,
//               and perform administrative tasks for the business.
//             </p>
//           </div>
//         )}
//       </div>

//       {/* Submit */}
//       <ButtonWithSpinner type="submit" loading={loading} disabled={submitDisabled}>
//         {loading ? "Adding Staff..." : "Add Staff"}
//       </ButtonWithSpinner>
//     </form>
//   );
// }
