// components/forms/AddStaffForm.tsx
//
// Purpose:
// - Handles UI for adding staff members.
// - Includes option to mark staff as ADMIN via a checkbox.
// - Provides an info tooltip explaining what "Admin" means.
// - Calls /api/staff/add → creates staff + Stripe Checkout session.
// - Redirects browser to Stripe checkoutUrl.

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
  const [isAdmin, setIsAdmin] = useState(false); // ✅ New: track admin checkbox
  const [showInfo, setShowInfo] = useState(false); // ✅ New: toggle tooltip

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ✅ Call API with new `isAdmin` flag
      const res = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, isAdmin }),
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
      setIsAdmin(false);
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

      {/* ✅ Make Admin Option */}
      <div className="flex items-center gap-2 mt-2 relative">
        <input
          id="isAdmin"
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
          className="w-5 h-5"
        />
        <label htmlFor="isAdmin" className="text-white text-sm md:text-base">
          Make this staff member an Admin
        </label>

        {/* ℹ️ Info Icon */}
        <button
          type="button"
          onClick={() => setShowInfo((prev) => !prev)}
          className="ml-2 text-white hover:text-blue-300 font-bold cursor-pointer"
        >
          ℹ️
        </button>

        {/* Info Tooltip */}
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
      <ButtonWithSpinner type="submit" loading={loading}>
        {loading ? "Adding Staff..." : "Add Staff"}
      </ButtonWithSpinner>
    </form>
  );
}
