import TopofPageContent from "../../components/topPage/topOfPageStyle";
import Login from "../../components/forms/loginForm";


export default function LoginPage() {
    return (
        <>
        <main>
            {/* Top of page content */}
            <TopofPageContent 
                HeadingOneTitle="Start the Journey today"
                paragraphContent="Get an insight into the local Aboriginal Community (placeholder text for now)"
                linkOne="No Account? Sign up Now!"
            />    
        </main>
        <section className="w-full flex flex-col justify-center items-center bg-gradient-to-b from-blue-700 to-blue-300 mt-40">
            {/* Login Heading */}
            <h2 className="text-white font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide px-4 sm:px-0 py-8 text-center text-shadow-2xl">Log In</h2>
            <Login />
        </section>
        
        </>
    );
}