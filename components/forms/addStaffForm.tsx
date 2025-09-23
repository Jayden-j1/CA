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









// // components/forms/AddStaffForm.tsx
// //
// // Purpose:
// // - Lets BUSINESS_OWNERs add staff accounts securely.
// // - Shows toast notifications (success/error) with role-aware messages.
// //   Example:  "Staff added successfully as USER!" or
// //             "Staff added successfully as ADMIN!"
// // - Calls /api/staff/add endpoint, which must return { message, role }.
// //
// // Requirements:
// // - react-hot-toast installed (`npm install react-hot-toast`).
// // - <Toaster /> already set up in app/layout.tsx with custom theme.

// 'use client';

// import { useState, FormEvent } from "react";
// import toast from "react-hot-toast";

// interface AddStaffFormProps {
//   onSuccess?: () => void; // optional callback to refresh staff list in parent
// }

// export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
//   // --- Form state ---
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // --- Handle form submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     console.log("[AddStaffForm] Submitting with data:", {
//       name,
//       email,
//       password,
//     });

//     try {
//       // Call backend API to create staff user
//       const res = await fetch("/api/staff/add", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, email, password }),
//       });

//       console.log("[AddStaffForm] Raw response:", res);
//       const data = await res.json();
//       console.log("[AddStaffForm] Parsed response JSON:", data);

//       if (!res.ok) {
//         //  Show error toast
//         toast.error(data.error || "Error adding staff user");
//         return;
//       }

//       //  Success toast: use role from backend response
//       if (data.role) {
//         toast.success(`🎉 ${data.message} Added as ${data.role}!`);
//       } else {
//         toast.success("🎉 Staff member added successfully!");
//       }

//       // Reset form fields
//       setName("");
//       setEmail("");
//       setPassword("");

//       // Trigger parent refresh (so staff list updates)
//       if (onSuccess) onSuccess();
//     } catch (error) {
//       console.error("[AddStaffForm] Unexpected error:", error);
//       toast.error("Internal error, please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --- Render form ---
//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Name Input */}
//       <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
//         Name
//       </label>
//       <input
//         type="text"
//         id="name"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         required
//         placeholder="Staff full name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Email Input */}
//       <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         placeholder="staff@business.com"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Password Input with toggle */}
//       <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
//         Password
//       </label>
//       <div className="relative">
//         <input
//           type={showPassword ? "text" : "password"}
//           id="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           placeholder="Enter a password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* Submit Button */}
//       <button
//         type="submit"
//         disabled={loading}
//         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
//       >
//         {loading ? "Adding Staff..." : "Add Staff"}
//       </button>
//     </form>
//   );
// }









// // components/forms/AddStaffForm.tsx
// //
// // Purpose:
// // - Lets BUSINESS_OWNERs add staff accounts securely.
// // - Shows toast notifications (success/error) with a celebratory, role-reinforcing message.
// // - Calls /api/staff/add endpoint (server-side protected).
// //
// // Requirements:
// // - react-hot-toast installed (`npm install react-hot-toast`)
// // - <Toaster /> added globally in app/layout.tsx for consistent theming.

// 'use client';

// import { useState, FormEvent } from "react";
// import toast from "react-hot-toast"; // ✅ Toast notifications

// interface AddStaffFormProps {
//   onSuccess?: () => void; // optional callback to refresh staff list in parent
// }

// export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
//   // --- Form state ---
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   // --- Handle form submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     console.log("📨 [AddStaffForm] Submitting with data:", {
//       name,
//       email,
//       password,
//     });

//     try {
//       // Call backend API to create staff user
//       const res = await fetch("/api/staff/add", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, email, password }),
//       });

//       console.log("📨 [AddStaffForm] Raw response:", res);
//       const data = await res.json();
//       console.log("📨 [AddStaffForm] Parsed response JSON:", data);

//       if (!res.ok) {
//         // ❌ Show error toast
//         toast.error(data.error || "Error adding staff user");
//         return;
//       }

//       // ✅ Success toast (personal + celebratory for Business Owner)
//       toast.success(`🎉 Staff member added successfully! Great work, Business Owner!`);

//       // Reset form fields
//       setName(""); 
//       setEmail(""); 
//       setPassword("");

//       // Trigger parent refresh (so staff list updates)
//       if (onSuccess) onSuccess();
//     } catch (error) {
//       console.error("❌ [AddStaffForm] Unexpected error:", error);
//       toast.error("Internal error, please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // --- Render form ---
//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Name Input */}
//       <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
//         Name
//       </label>
//       <input
//         type="text"
//         id="name"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         required
//         placeholder="Staff full name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Email Input */}
//       <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         placeholder="staff@business.com"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Password Input with toggle */}
//       <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
//         Password
//       </label>
//       <div className="relative">
//         <input
//           type={showPassword ? "text" : "password"}
//           id="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           placeholder="Enter a password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* Submit Button */}
//       <button
//         type="submit"
//         disabled={loading}
//         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
//       >
//         {loading ? "Adding Staff..." : "Add Staff"}
//       </button>
//     </form>
//   );
// }









// components/forms/AddStaffForm.tsx
//
// Purpose:
// - Lets BUSINESS_OWNERs add staff accounts.
// - Shows toast notifications (success/error) instead of inline text.
// - Still logs raw responses + JSON for debugging.
// - Calls /api/staff/add endpoint securely.
//
// Requirements:
// - react-hot-toast installed
// - <Toaster /> added in app/layout.tsx

// 'use client';

// import { useState, FormEvent } from "react";
// import toast from "react-hot-toast"; // ✅ Toast import

// interface AddStaffFormProps {
//   onSuccess?: () => void;
// }

// export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);

//   const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setLoading(true);

//     console.log("📨 [AddStaffForm] Submitting with data:", {
//       name,
//       email,
//       password,
//     });

//     try {
//       const res = await fetch("/api/staff/add", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, email, password }),
//       });

//       console.log("📨 [AddStaffForm] Raw response:", res);
//       const data = await res.json();
//       console.log("📨 [AddStaffForm] Parsed response JSON:", data);

//       if (!res.ok) {
//         // ❌ Show error as toast
//         toast.error(data.error || "Error adding staff user");
//         return;
//       }

//       // ✅ Success toast
//       toast.success("Staff user added successfully!");

//       // Clear form fields
//       setName(""); setEmail(""); setPassword("");

//       // Trigger parent refresh (staff list reload)
//       if (onSuccess) onSuccess();
//     } catch (error) {
//       console.error("❌ [AddStaffForm] Unexpected error:", error);
//       toast.error("Internal error, please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Name */}
//       <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
//         Name
//       </label>
//       <input
//         type="text"
//         id="name"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         required
//         placeholder="Staff full name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Email */}
//       <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         placeholder="staff@business.com"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3 bg-transparent text-white placeholder-white"
//       />

//       {/* Password */}
//       <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
//         Password
//       </label>
//       <div className="relative">
//         <input
//           type={showPassword ? "text" : "password"}
//           id="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           placeholder="Enter a password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20 bg-transparent text-white placeholder-white"
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* Submit */}
//       <button
//         type="submit"
//         disabled={loading}
//         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
//       >
//         {loading ? "Adding Staff..." : "Add Staff"}
//       </button>
//     </form>
//   );
// }









// // components/forms/addStaffForm.tsx
// //
// // Purpose:
// // - Renders a form for BUSINESS_OWNERs to add staff users.
// // - Calls the secure API endpoint at /api/staff/add.
// // - Shows success/error messages directly in the UI.
// // - Accepts optional `onSuccess` callback so the parent page can refresh staff list.
// //

// 'use client';

// import { useState, FormEvent } from "react";

// // Optional: parent page can pass onSuccess callback to refresh staff list
// interface AddStaffFormProps {
//   onSuccess?: () => void;
// }

// export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
//   // --- Form state ---
//   const [name, setName] = useState("");          // Staff full name
//   const [email, setEmail] = useState("");        // Staff email
//   const [password, setPassword] = useState("");  // Staff password (optional, hashed by backend)
//   const [showPassword, setShowPassword] = useState(false); 
//   const [statusMessage, setStatusMessage] = useState(""); // Success/error messages

//   // Toggle password visibility
//   const togglePasswordVisibility = () => setShowPassword(prev => !prev);

//   // --- Handle form submission ---
//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setStatusMessage("");

//     try {
//       // 1. Call the backend API at /api/staff/add
//       const res = await fetch("/api/staff/add", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, email, password }),
//       });

//       const data = await res.json();

//       // 2. Handle error response from server
//       if (!res.ok) {
//         setStatusMessage(data.error || "Error adding staff user");
//         return;
//       }

//       // 3. On success → clear form, show message, refresh staff list
//       setStatusMessage("✅ Staff user added successfully!");
//       setName(""); setEmail(""); setPassword("");

//       if (onSuccess) onSuccess();
//     } catch (error) {
//       console.error("❌ AddStaffForm error:", error);
//       setStatusMessage("Internal error, please try again.");
//     }
//   };

//   // --- Render form ---
//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
//       {/* Name Input */}
//       <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
//         Name
//       </label>
//       <input
//         type="text"
//         id="name"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         required
//         placeholder="Staff full name"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
//       />

//       {/* Email Input */}
//       <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
//         Email
//       </label>
//       <input
//         type="email"
//         id="email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//         required
//         placeholder="staff@business.com"
//         className="block w-full border-white border-2 rounded-2xl px-4 py-3
//           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//           bg-transparent text-white placeholder-white"
//       />

//       {/* Password Input */}
//       <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
//         Password
//       </label>
//       <div className="relative">
//         <input
//           type={showPassword ? "text" : "password"}
//           id="password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//           placeholder="Enter a password"
//           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
//             focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
//             bg-transparent text-white placeholder-white"
//         />
//         <button
//           type="button"
//           onClick={togglePasswordVisibility}
//           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
//           tabIndex={-1}
//         >
//           {showPassword ? "Hide" : "Show"}
//         </button>
//       </div>

//       {/* Submit Button */}
//       <button
//         type="submit"
//         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
//           border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
//       >
//         Add Staff
//       </button>

//       {/* Status Message */}
//       {statusMessage && (
//         <p className="text-white text-center mt-2">{statusMessage}</p>
//       )}
//     </form>
//   );
// }







// // 'use client';

// // import { useState, FormEvent } from "react";

// // // Optional: onSuccess callback to refresh staff list
// // interface AddStaffFormProps {
// //   onSuccess?: () => void;
// // }

// // export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
// //   const [name, setName] = useState("");       // Staff full name
// //   const [email, setEmail] = useState("");     // Staff email
// //   const [password, setPassword] = useState(""); // Staff password
// //   const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
// //   const [statusMessage, setStatusMessage] = useState(""); // Show success/error messages

// //   // Toggle password visibility
// //   const togglePasswordVisibility = () => setShowPassword(prev => !prev);

// //   // Form submit handler
// //   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
// //     e.preventDefault();
// //     setStatusMessage("");

// //     try {
// //       // Call backend API to add staff
// //       const res = await fetch("/api/staff", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({ name, email, password }),
// //       });

// //       const data = await res.json();

// //       if (!res.ok) {
// //         // Show error from backend
// //         setStatusMessage(data.error || "Error adding staff user");
// //         return;
// //       }

// //       // Success: clear form and show message
// //       setStatusMessage("Staff user added successfully!");
// //       setName(""); setEmail(""); setPassword("");

// //       // Optional: trigger refresh of staff list on dashboard
// //       if (onSuccess) onSuccess();
// //     } catch (error) {
// //       console.error(error);
// //       setStatusMessage("Internal error");
// //     }
// //   };

// //   return (
// //     <form
// //       onSubmit={handleSubmit}
// //       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
// //     >
// //       {/* Name Input */}
// //       <label htmlFor="name" className="text-white font-bold text-sm md:text-base">
// //         Name
// //       </label>
// //       <input
// //         type="text"
// //         id="name"
// //         value={name}
// //         onChange={(e) => setName(e.target.value)}
// //         required
// //         placeholder="Staff full name"
// //         className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //           bg-transparent text-white placeholder-white"
// //       />

// //       {/* Email Input */}
// //       <label htmlFor="email" className="text-white font-bold text-sm md:text-base">
// //         Email
// //       </label>
// //       <input
// //         type="email"
// //         id="email"
// //         value={email}
// //         onChange={(e) => setEmail(e.target.value)}
// //         required
// //         placeholder="staff@business.com"
// //         className="block w-full border-white border-2 rounded-2xl px-4 py-3
// //           focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //           bg-transparent text-white placeholder-white"
// //       />

// //       {/* Password Input */}
// //       <label htmlFor="password" className="text-white font-bold text-sm md:text-base">
// //         Password
// //       </label>
// //       <div className="relative">
// //         <input
// //           type={showPassword ? "text" : "password"}
// //           id="password"
// //           value={password}
// //           onChange={(e) => setPassword(e.target.value)}
// //           required
// //           placeholder="Enter a password"
// //           className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
// //             focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
// //             bg-transparent text-white placeholder-white"
// //         />
// //         <button
// //           type="button"
// //           onClick={togglePasswordVisibility}
// //           className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-xs hover:underline focus:outline-none"
// //           tabIndex={-1}
// //         >
// //           {showPassword ? "Hide" : "Show"}
// //         </button>
// //       </div>

// //       {/* Submit Button */}
// //       <button
// //         type="submit"
// //         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
// //           border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
// //       >
// //         Add Staff
// //       </button>

// //       {/* Status Message */}
// //       {statusMessage && (
// //         <p className="text-white text-center mt-2">{statusMessage}</p>
// //       )}
// //     </form>
// //   );
// // }











