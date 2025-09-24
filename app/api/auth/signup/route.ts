// app/api/auth/signup/route.ts
//
// Purpose:
// - Handles signup for both individuals and business owners.
// - Hashes the password securely using bcrypt before saving.
// - Creates a related Business record if the user is a BUSINESS_OWNER.
// - Returns the new user's role so the frontend can display a tailored toast.
//
// New in this version:
// - On unexpected errors (e.g., DB connection issue), respond with
//   { error: "...", systemError: true } and a 500 status.
//   → The frontend can detect this and trigger a purple "system error" toast.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    // 1. Parse JSON request body
    const body = await req.json();
    const { name, email, password, userType, businessName } = body;

    // 2. Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Prevent duplicate accounts
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // 4. Hash the password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Decide role based on signup type
    const role = userType === "business" ? "BUSINESS_OWNER" : "USER";

    // 6. Create the user (with hashedPassword)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword, // ✅ correct field name matches Prisma schema
        role,
      },
    });

    console.log("[API] User created:", { id: user.id, role: user.role });

    // 7. If BUSINESS_OWNER, also create a Business record
    if (role === "BUSINESS_OWNER") {
      if (!businessName) {
        return NextResponse.json(
          { error: "Business name is required for business accounts" },
          { status: 400 }
        );
      }

      const emailDomain = email.split("@")[1]; // e.g., "company.com"
      const business = await prisma.business.create({
        data: {
          name: businessName,
          domain: emailDomain,
          owner: { connect: { id: user.id } }, // link business to owner
        },
      });

      console.log("[API] Business created:", { id: business.id });

      // Update the user record to reference their new business
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });

      console.log("[API] Linked business back to user:", {
        userId: user.id,
        businessId: business.id,
      });
    }

    // 8. Success response with role (frontend uses it for toasts)
    return NextResponse.json(
      { message: "User created successfully", role: user.role },
      { status: 201 }
    );
  } catch (error) {
    // ------------------------------
    // Handle unexpected errors
    // ------------------------------
    console.error("[API] Signup error:", error);

    // ✅ Explicitly flag this as a systemError
    return NextResponse.json(
      {
        error: "Internal Server Error",
        systemError: true, // frontend looks for this to trigger purple toast
      },
      { status: 500 }
    );
  }
}

// Disallow GET requests for this route
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST." },
    { status: 405 }
  );
}









// // app/api/auth/signup/route.ts
// //
// // Purpose:
// // - Handles signup for both individuals and business owners.
// // - Hashes the password securely using bcrypt before saving.
// // - Creates a related Business record if the user is a BUSINESS_OWNER.
// // - Returns the new user's role so the frontend can display a tailored toast.
// //
// // Notes:
// // - Uses Prisma ORM to interact with the database.
// // - Your schema defines `hashedPassword`, not `password`.
// // - GET requests are explicitly blocked with a 405 response.

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import bcrypt from "bcryptjs";

// export async function POST(req: NextRequest) {
//   try {
//     console.log("[API] Signup route hit with POST");

//     // 1. Parse JSON request body
//     const body = await req.json();
//     const { name, email, password, userType, businessName } = body;

//     // 2. Validate required fields
//     if (!name || !email || !password) {
//       return NextResponse.json(
//         { error: "Missing required fields" },
//         { status: 400 }
//       );
//     }

//     // 3. Prevent duplicate accounts
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) {
//       return NextResponse.json(
//         { error: "User already exists" },
//         { status: 400 }
//       );
//     }

//     // 4. Hash the password before storing
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 5. Decide role based on signup type
//     const role = userType === "business" ? "BUSINESS_OWNER" : "USER";

//     // 6. Create the user (with hashedPassword)
//     const user = await prisma.user.create({
//       data: {
//         name,
//         email,
//         hashedPassword, // ✅ correct field name matches Prisma schema
//         role,
//       },
//     });

//     console.log("[API] User created:", { id: user.id, role: user.role });

//     // 7. If BUSINESS_OWNER, also create a Business record
//     if (role === "BUSINESS_OWNER") {
//       if (!businessName) {
//         return NextResponse.json(
//           { error: "Business name is required for business accounts" },
//           { status: 400 }
//         );
//       }

//       const emailDomain = email.split("@")[1]; // e.g., "company.com"
//       const business = await prisma.business.create({
//         data: {
//           name: businessName,
//           domain: emailDomain,
//           owner: { connect: { id: user.id } }, // link business to owner
//         },
//       });

//       console.log("[API] Business created:", { id: business.id });

//       // Update the user record to reference their new business
//       await prisma.user.update({
//         where: { id: user.id },
//         data: { businessId: business.id },
//       });

//       console.log("[API] Linked business back to user:", {
//         userId: user.id,
//         businessId: business.id,
//       });
//     }

//     // 8. Success response with role (frontend uses it for toasts)
//     return NextResponse.json(
//       { message: "User created successfully", role: user.role },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("[API] Signup error:", error);
//     return NextResponse.json(
//       { error: "Internal Server Error" },
//       { status: 500 }
//     );
//   }
// }

// // Disallow GET requests for this route
// export async function GET() {
//   return NextResponse.json(
//     { error: "Method Not Allowed. Use POST." },
//     { status: 405 }
//   );
// }
