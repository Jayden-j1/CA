// app/api/auth/signup/route.ts
//
// Purpose:
// - Create a new user securely, enforce strong password, prevent duplicates.
// - If business owner, create a Business record and link it.
// - Returns a simple JSON with role + userId (non-breaking addition).
//
// Notes:
// - We DO NOT automatically sign the user in here. The client form handles
//   silent sign-in after a successful POST using next-auth credentials.
//   (This keeps the API route pure and avoids mixing concerns.)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "@/lib/validator"; // ✅ import validator

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Signup route hit with POST");

    // 1. Parse request body
    const body = await req.json();
    const { name, email, password, userType, businessName } = body;

    // 2. Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 3. Enforce password complexity
    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    // 4. Prevent duplicate accounts
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 6. Decide role
    const role = userType === "business" ? "BUSINESS_OWNER" : "USER";

    // 7. Create user
    const user = await prisma.user.create({
      data: { name, email, hashedPassword, role },
      select: { id: true, role: true }, // keep response minimal
    });

    console.log("[API] User created:", { id: user.id, role: user.role });

    // 8. If business owner, create Business record
    if (role === "BUSINESS_OWNER") {
      if (!businessName) {
        return NextResponse.json(
          { error: "Business name is required for business accounts" },
          { status: 400 }
        );
      }

      const emailDomain = email.split("@")[1];
      const business = await prisma.business.create({
        data: {
          name: businessName,
          domain: emailDomain,
          owner: { connect: { id: user.id } },
        },
        select: { id: true },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });
    }

    // 9. Return role + userId (non-breaking)
    return NextResponse.json(
      { message: "User created successfully", role: user.role, userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Signup error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", systemError: true },
      { status: 500 }
    );
  }
}









// // app/api/auth/signup/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import bcrypt from "bcryptjs";
// import { isStrongPassword } from "@/lib/validator"; // ✅ import validator

// export async function POST(req: NextRequest) {
//   try {
//     console.log("[API] Signup route hit with POST");

//     // 1. Parse request body
//     const body = await req.json();
//     const { name, email, password, userType, businessName } = body;

//     // 2. Validate required fields
//     if (!name || !email || !password) {
//       return NextResponse.json(
//         { error: "Missing required fields" },
//         { status: 400 }
//       );
//     }

//     // 3. Enforce password complexity
//     if (!isStrongPassword(password)) {
//       return NextResponse.json(
//         {
//           error:
//             "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
//         },
//         { status: 400 }
//       );
//     }

//     // 4. Prevent duplicate accounts
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) {
//       return NextResponse.json(
//         { error: "User already exists" },
//         { status: 400 }
//       );
//     }

//     // 5. Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 6. Decide role
//     const role = userType === "business" ? "BUSINESS_OWNER" : "USER";

//     // 7. Create user
//     const user = await prisma.user.create({
//       data: { name, email, hashedPassword, role },
//     });

//     console.log("[API] User created:", { id: user.id, role: user.role });

//     // 8. If business owner, create Business record
//     if (role === "BUSINESS_OWNER") {
//       if (!businessName) {
//         return NextResponse.json(
//           { error: "Business name is required for business accounts" },
//           { status: 400 }
//         );
//       }

//       const emailDomain = email.split("@")[1];
//       const business = await prisma.business.create({
//         data: {
//           name: businessName,
//           domain: emailDomain,
//           owner: { connect: { id: user.id } },
//         },
//       });

//       await prisma.user.update({
//         where: { id: user.id },
//         data: { businessId: business.id },
//       });
//     }

//     return NextResponse.json(
//       { message: "User created successfully", role: user.role },
//       { status: 201 }
//     );
//   } catch (error) {
//     console.error("[API] Signup error:", error);
//     return NextResponse.json(
//       { error: "Internal Server Error", systemError: true },
//       { status: 500 }
//     );
//   }
// }
