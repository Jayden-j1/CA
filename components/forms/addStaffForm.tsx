// components/forms/AddStaffForm.tsx
//
// Purpose:
// - Lets BUSINESS_OWNERs add staff accounts securely.
// - Shows celebratory + role-aware toast messages based on API response.
//   Example: " Staff added successfully as USER!"
// - Mirrors signup flow toast personalization for UX consistency.
//
// Requirements:
// - Backend /api/staff/add must return { message, role } in JSON.
// - react-hot-toast installed
// - <Toaster /> set globally in app/layout.tsx with custom theme

'use client';

import ButtonWithSpinner from "../ui/buttonWithSpinner";  // Import Spinner Component


import { useState, FormEvent } from "react";
import toast from "react-hot-toast";

interface AddStaffFormProps {
  onSuccess?: () => void; // Optional callback to refresh staff list in parent
}

export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
  // --- Form state ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Toggle password visibility
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  // --- Handle form submission ---
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    console.log("[AddStaffForm] Submitting with data:", {
      name,
      email,
      password,
    });

    try {
      // Call backend API
      const res = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      console.log("[AddStaffForm] Parsed response JSON:", data);

      if (!res.ok) {
        //  Show error toast
        toast.error(data.error || "Error adding staff user");
        return;
      }

      //  Role-aware success toast (mirrors signup UX)
      if (data.role) {
        // Reinforce role identity (e.g., "USER", "ADMIN")
        toast.success(`🎉 ${data.message} Added as ${data.role}!`);
      } else {
        // Fallback if role is missing (shouldn’t happen if backend is correct)
        toast.success("🎉 Staff member added successfully!");
      }

      // Reset form fields
      setName("");
      setEmail("");
      setPassword("");

      // Trigger parent refresh (e.g., staff list update)
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("[AddStaffForm] Unexpected error:", error);
      toast.error("Internal error, please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Render form ---
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
    >
      {/* Name Input */}
      <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
        Name
      </label>
      <input
        type="text"
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Staff full name"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* Email Input */}
      <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
        Email
      </label>
      <input
        type="email"
        id="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="staff@business.com"
        className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
      />

      {/* Password Input with toggle */}
      <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
        Password
      </label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter a password"
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
          tabIndex={-1}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      {/* Submit Button */}
      <ButtonWithSpinner type="submit" loading={loading}>
        {loading ? "Adding Staff..." : "Add Staff"}
      </ButtonWithSpinner>
    </form>
  );
}









