'use client';

import { useState, FormEvent } from "react";

// Optional: onSuccess callback to refresh staff list
interface AddStaffFormProps {
  onSuccess?: () => void;
}

export default function AddStaffForm({ onSuccess }: AddStaffFormProps) {
  const [name, setName] = useState("");       // Staff full name
  const [email, setEmail] = useState("");     // Staff email
  const [password, setPassword] = useState(""); // Staff password
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
  const [statusMessage, setStatusMessage] = useState(""); // Show success/error messages

  // Toggle password visibility
  const togglePasswordVisibility = () => setShowPassword(prev => !prev);

  // Form submit handler
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage("");

    try {
      // Call backend API to add staff
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Show error from backend
        setStatusMessage(data.error || "Error adding staff user");
        return;
      }

      // Success: clear form and show message
      setStatusMessage("Staff user added successfully!");
      setName(""); setEmail(""); setPassword("");

      // Optional: trigger refresh of staff list on dashboard
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      setStatusMessage("Internal error");
    }
  };

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
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white"
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
        className="block w-full border-white border-2 rounded-2xl px-4 py-3
          focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
          bg-transparent text-white placeholder-white"
      />

      {/* Password Input */}
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
          className="block w-full border-white border-2 rounded-2xl px-4 py-3 pr-20
            focus:outline-none focus:border-white focus:border-4 text-sm md:text-base
            bg-transparent text-white placeholder-white"
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
      <button
        type="submit"
        className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
          border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
      >
        Add Staff
      </button>

      {/* Status Message */}
      {statusMessage && (
        <p className="text-white text-center mt-2">{statusMessage}</p>
      )}
    </form>
  );
}











// 'use client';

// import { useState, FormEvent } from "react";


// interface AddStaffFormProps {
//   onSuccess?: () => void;
// }


// export default function AddStaffForm( { onSuccess }: AddStaffFormProps ) {
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [statusMessage, setStatusMessage] = useState("");

//   const togglePasswordVisibility = () => setShowPassword(prev => !prev);

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setStatusMessage("");

//     try {
//       const res = await fetch("/api/staff", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ name, email, password }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         setStatusMessage(data.error || "Error adding staff user");
//         return;
//       }

//       setStatusMessage("Staff user added successfully!");
//       setName("");
//       setEmail("");
//       setPassword("");
//     } catch (error) {
//       console.error(error);
//       setStatusMessage("Internal error");
//     }
//   };

//   return (
//     <form
//       onSubmit={handleSubmit}
//       className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]"
//     >
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

//       <button
//         type="submit"
//         className="px-8 py-4 bg-green-600 text-white hover:bg-green-500 font-bold rounded-4xl shadow-2xl
//           border-2 border-white text-sm md:text-base transition-colors duration-200 cursor-pointer"
//       >
//         Add Staff
//       </button>

//       {statusMessage && (
//         <p className="text-white text-center mt-2">{statusMessage}</p>
//       )}
//     </form>

//       if (!res.ok) {
//     setStatusMessage(data.error || "Error adding staff user");
//     return;
//   }

//   setStatusMessage("Staff user added successfully!");
//   setName(""); setEmail(""); setPassword("");
//   if (onSuccess) onSuccess(); // Trigger refresh
// }
//   );
// }
