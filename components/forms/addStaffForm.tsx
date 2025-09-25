// components/forms/AddStaffForm.tsx
//
// Purpose:
// - Handles UI for adding staff members.
// - Calls /api/staff/add → creates staff + Stripe Checkout session.
// - Redirects browser to Stripe checkoutUrl.
// - Shows toasts on error, but not on success (Stripe redirect happens too fast).
//
// Notes:
// - onSuccess callback is still used if you want to refresh staff list
//   when user comes back from Stripe (?success=true / ?canceled=true).
// - Uses ButtonWithSpinner for UX.

"use client";

import ButtonWithSpinner from "../ui/buttonWithSpinner";
import { useState, FormEvent } from "react";
import toast from "react-hot-toast";

interface AddStaffFormProps {
  onSuccess?: () => void;
}

export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Call API
      const res = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Error adding staff");
        return;
      }

      // ✅ Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return; // stop further execution (redirecting away)
      }

      // Fallback: success but no checkoutUrl
      toast.success("🎉 Staff created successfully (no payment link).");

      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("[AddStaffForm] Unexpected error:", error);
      toast.error("Internal error, please try again.");
    } finally {
      setLoading(false);
    }
  };

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
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* Staff Password */}
      <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
        Password
      </label>
      <div className="relative">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter password"
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline"
          tabIndex={-1}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {/* Submit */}
      <ButtonWithSpinner type="submit" loading={loading}>
        {loading ? "Adding Staff..." : "Add Staff"}
      </ButtonWithSpinner>
    </form>
  );
}
