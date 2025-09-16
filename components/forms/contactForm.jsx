export default function ContactFormComponent() {
    return (
        // Form
        <form action="#" method="#" className="flex flex-col gap-4 p-6 sm:p-8 md:p-10 w-[90%] sm:w-[400px] md:w-[450px] lg:w-[500px]">

            {/* Name Label and Input */}
            <label htmlFor="name" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Name</label>
            <input type="text" name="name" id="name" required autoFocus/>


            {/* Mobile Number Label and Input */}
            <label htmlFor="moblieNumber" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Mobile</label>
            <input type="tel" name="mobileNumber" id="mobileNumber" required autoFocus/>

            {/* Mobile Number Label and Input */}
            <label htmlFor="phoneNumber" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Phone</label>
            <input type="tel" name="phoneNumber" id="phoneNumber" required autoFocus/>

            {/* Email Label and Input */}
            <label htmlFor="contactEmail" className="text-left text-white font-bold text-sm tracking-wide md:text-base">Email</label>
            <input type="emai" name="email" id="email" required autoFocus/>


        </form>
    );
}