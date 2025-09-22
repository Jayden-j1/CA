// app/api/auth/signup/route.ts
//
// Purpose:
// - Handles signup for both "individual" and "business" accounts.
// - Hashes passwords securely before saving.
// - Creates a Business record when a BUSINESS_OWNER signs up.
// - Returns the new user's role in the response so the frontend
//   can display personalized toasts (welcome messages).
//
// Notes:
// - All logs go to your terminal (npm run dev).
// - Use POST only; GET returns 405.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    console.log("✅ [API] Signup route hit with POST request");

    // 1. Parse request body
    const body = await req.json();
    console.log("📦 [API] Raw request body:", body);

    const { name, email, password, userType, businessName } = body;

    // 2. Validate required fields
    if (!name || !email || !password) {
      console.warn("⚠️ [API] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.warn("⚠️ [API] Duplicate signup attempt:", email);
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // 4. Hash password
    console.log("🔑 [API] Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Create user with correct role
    const role = userType === "business" ? "BUSINESS_OWNER" : "USER";
    console.log("👤 [API] Creating user with role:", role);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });

    console.log("✅ [API] User created:", { id: user.id, role: user.role });

    // 6. If business owner, create a Business record
    if (userType === "business") {
      if (!businessName) {
        return NextResponse.json(
          { error: "Business name is required for business accounts" },
          { status: 400 }
        );
      }

      const emailDomain = email.split("@")[1];
      console.log("🏢 [API] Creating business with domain:", emailDomain);

      const business = await prisma.business.create({
        data: {
          name: businessName,
          domain: emailDomain,
          owner: { connect: { id: user.id } },
        },
      });

      console.log("✅ [API] Business created:", { id: business.id });

      // Link business back to user
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });
      console.log("🔗 [API] Linked business to user");
    }

    // 7. Success → Return role as well for frontend toast
    return NextResponse.json({
      message: "User created successfully",
      role: user.role, // ✅ frontend uses this for personalized toasts
    });
  } catch (error) {
    console.error("❌ [API] Signup error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Handle accidental GET requests
export async function GET() {
  console.warn("⚠️ [API] Signup route hit with GET (not allowed)");
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST instead." },
    { status: 405 }
  );
}






// // app/api/auth/signup/route.ts
// //
// // Purpose:
// // - Handle signups for both "individual" and "business" accounts.
// // - Hash passwords before storing them.
// // - If userType = "business": create a Business record + link owner.
// // - Includes detailed debug logs so you can trace each step in terminal.
// //
// // Notes:
// // - Logs go to your terminal (where `npm run dev` is running).
// // - These logs will help confirm whether the form is POSTing correctly
// //   or if a GET/405 is being triggered instead.

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import bcrypt from "bcryptjs";

// export async function POST(req: NextRequest) {
//   try {
//     // ✅ Confirm route hit
//     console.log("✅ [API] Signup route hit with POST request");

//     // 1. Parse request body
//     const body = await req.json();
//     console.log("📦 [API] Raw request body:", body);

//     const { name, email, password, userType, businessName } = body;

//     // 2. Validate input
//     if (!name || !email || !password) {
//       console.warn("⚠️ [API] Missing required fields:", { name, email, password });
//       return NextResponse.json(
//         { error: "Missing required fields" },
//         { status: 400 }
//       );
//     }

//     // 3. Check if user already exists
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) {
//       console.warn("⚠️ [API] Attempt to create duplicate user:", email);
//       return NextResponse.json(
//         { error: "User already exists" },
//         { status: 400 }
//       );
//     }

//     // 4. Hash the password
//     console.log("🔑 [API] Hashing password...");
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 5. Create user
//     console.log("👤 [API] Creating user record in DB...");
//     const user = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         role: userType === "business" ? "BUSINESS_OWNER" : "USER",
//       },
//     });
//     console.log("✅ [API] User created:", { id: user.id, email: user.email });

//     // 6. Handle business user
//     if (userType === "business") {
//       if (!businessName) {
//         console.warn("⚠️ [API] Business signup missing businessName");
//         return NextResponse.json(
//           { error: "Business name is required for business accounts" },
//           { status: 400 }
//         );
//       }

//       const emailDomain = email.split("@")[1];
//       console.log("🏢 [API] Creating business with domain:", emailDomain);

//       const business = await prisma.business.create({
//         data: {
//           name: businessName,
//           domain: emailDomain,
//           owner: { connect: { id: user.id } },
//         },
//       });

//       console.log("✅ [API] Business created:", { id: business.id, name: business.name });

//       // Link business back to user
//       await prisma.user.update({
//         where: { id: user.id },
//         data: { businessId: business.id },
//       });
//       console.log("🔗 [API] Linked user to business");
//     }

//     // 7. Success
//     console.log("🎉 [API] Signup completed successfully for:", email);
//     return NextResponse.json({ message: "User created successfully" });
//   } catch (error) {
//     console.error("❌ [API] Signup error:", error);
//     return NextResponse.json(
//       { error: "Internal Server Error" },
//       { status: 500 }
//     );
//   }
// }

// // ❌ Debug safety: If someone accidentally calls GET, log it clearly
// export async function GET() {
//   console.warn("⚠️ [API] Signup route hit with GET (not allowed)");
//   return NextResponse.json(
//     { error: "Method Not Allowed. Use POST instead." },
//     { status: 405 }
//   );
// }
