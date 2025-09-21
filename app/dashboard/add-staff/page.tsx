import AddStaffForm from "@/components/forms/addStaffForm";

export default function AddStaffPage() {
  return (
    <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 min-h-screen py-20">
      <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide mb-8 text-center">
        Add Staff User
      </h2>
      <AddStaffForm />
    </section>
  );
}
