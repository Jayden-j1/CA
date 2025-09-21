'use client';

import { useEffect, useState } from "react";
import AddStaffForm from "@/components/forms/addStaffForm";

// Interface for staff user
interface Staff {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function StaffDashboardPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]); // Store staff
  const [loading, setLoading] = useState(true);           // Loading state
  const [error, setError] = useState("");                 // Error message

  // Fetch staff list from API
  const fetchStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/list");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch staff");
      } else {
        setStaffList(data.staff);
      }
    } catch (err) {
      console.error(err);
      setError("Internal error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff on component mount
  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
      <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">Staff Management</h1>

      {/* Staff List */}
      <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
        <h2 className="font-bold text-xl mb-4">Current Staff</h2>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : staffList.length === 0 ? (
          <p>No staff added yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {staffList.map((staff) => (
              <li key={staff.id} className="py-2 flex justify-between">
                <span>{staff.name}</span>
                <span className="text-gray-500">{staff.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Staff Form */}
      <div className="w-[90%] sm:w-[600px] md:w-[800px]">
        {/* Pass fetchStaff as onSuccess to refresh list after adding */}
        <AddStaffForm onSuccess={fetchStaff} />
      </div>
    </section>
  );
}










// 'use client';

// import { useEffect, useState } from "react";
// import AddStaffForm from "@/components/forms/addStaffForm";

// interface Staff {
//   id: string;
//   name: string;
//   email: string;
//   createdAt: string;
// }

// export default function StaffDashboardPage() {
//   const [staffList, setStaffList] = useState<Staff[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   const fetchStaff = async () => {
//     setLoading(true);
//     setError("");
//     try {
//       const res = await fetch("/api/staff/list");
//       const data = await res.json();
//       if (!res.ok) {
//         setError(data.error || "Failed to fetch staff");
//       } else {
//         setStaffList(data.staff);
//       }
//     } catch (err) {
//       console.error(err);
//       setError("Internal error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchStaff();
//   }, []);

//   return (
//     <section className="w-full min-h-screen bg-gradient-to-b from-blue-700 to-blue-300 py-20 flex flex-col items-center gap-12">
//       <h1 className="text-white font-bold text-4xl sm:text-5xl text-center">Staff Management</h1>

//       {/* Staff List */}
//       <div className="w-[90%] sm:w-[600px] md:w-[800px] bg-white rounded-xl p-6 shadow-xl">
//         <h2 className="font-bold text-xl mb-4">Current Staff</h2>
//         {loading ? (
//           <p>Loading...</p>
//         ) : error ? (
//           <p className="text-red-500">{error}</p>
//         ) : staffList.length === 0 ? (
//           <p>No staff added yet.</p>
//         ) : (
//           <ul className="divide-y divide-gray-200">
//             {staffList.map((staff) => (
//               <li key={staff.id} className="py-2 flex justify-between">
//                 <span>{staff.name}</span>
//                 <span className="text-gray-500">{staff.email}</span>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>

//       {/* Add Staff Form */}
//       <div className="w-[90%] sm:w-[600px] md:w-[800px]">
//         <AddStaffForm />
//       </div>
//     </section>
//   );
// }
