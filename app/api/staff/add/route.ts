// app/api/staff/add/route.ts
//
// Purpose:
// - Handles adding new staff members to a business.
// - Protected by server-side auth + role checks.
// - Only BUSINESS_OWNER users can add staff.
// - Prevents duplicate staff accounts by email.
// - Returns role in the response so the frontend toast can
//   display celebratory + role-aware messages.
//
// Flow:
// 1. Validate POST request + required fields.
// 2. Ensure current user is BUSINESS_OWNER with valid businessId.
// 3. Create a new USER record linked to owner’s business.
// 4. Respond with { message, role, staff } for frontend.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Ensure only BUSINESS_OWNER can add staff
    if (session.user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Parse JSON body
    const { name, email, password } = await req.json();
    if (!name || !email) {
      return NextResponse.json(
        { error: "Missing required fields (name, email)" },
        { status: 400 }
      );
    }

    // 4. Ensure owner’s business exists
    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 400 }
      );
    }

    // 5. Prevent duplicate staff by email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // 6. Hash password if provided
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // 7. Create staff user (role = USER by default)
    const staffUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",   // staff members are normal users
        businessId,     // link staff to the owner’s business
      },
    });

    // 8. Return JSON with role for frontend toast
    return NextResponse.json({
      message: "Staff user created successfully",
      role: staffUser.role, //  frontend can display role-aware toast
      staff: {
        id: staffUser.id,
        name: staffUser.name,
        email: staffUser.email,
      },
    });
  } catch (error) {
    console.error("[API] Add staff error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}









// // app/api/staff/add/route.ts
// //
// // Purpose:
// // - Handles adding new staff members to a business.
// // - Protected by server-side auth + role checks.
// // - Only BUSINESS_OWNER users can add staff.
// // - Prevents regular USER accounts from creating other users.
// //
// // Flow:
// // 1. Validate that request is POST + JSON body contains required fields.
// // 2. Ensure logged-in user is BUSINESS_OWNER with a valid businessId.
// // 3. Create a new USER record linked to the owner’s business.

// import { NextRequest, NextResponse } from "next/server";
// import { getServerSession } from "next-auth/next";
// import { authOptions } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";
// import bcrypt from "bcryptjs"; // needed if you allow password setup for staff

// export async function POST(req: NextRequest) {
//   try {
//     // 1. Verify authentication
//     const session = await getServerSession(authOptions);
//     if (!session?.user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // 2. Only BUSINESS_OWNER can add staff
//     if (session.user.role !== "BUSINESS_OWNER") {
//       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//     }

//     // 3. Extract JSON body
//     const { name, email, password } = await req.json();

//     if (!name || !email) {
//       return NextResponse.json(
//         { error: "Missing required fields (name, email)" },
//         { status: 400 }
//       );
//     }

//     // 4. Ensure owner’s business exists
//     const businessId = session.user.businessId;
//     if (!businessId) {
//       return NextResponse.json(
//         { error: "Business not found" },
//         { status: 400 }
//       );
//     }

//     // 5. Prevent duplicate staff by email
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser) {
//       return NextResponse.json(
//         { error: "A user with this email already exists" },
//         { status: 400 }
//       );
//     }

//     // 6. Hash password if provided (optional: you could also set a temp password)
//     const hashedPassword = password
//       ? await bcrypt.hash(password, 10)
//       : null;

//     // 7. Create staff user
//     const staffUser = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: hashedPassword,
//         role: "USER", // staff are always role USER
//         businessId,   // link to owner’s business
//       },
//     });

//     return NextResponse.json({
//       message: "Staff user created successfully",
//       staff: { id: staffUser.id, name: staffUser.name, email: staffUser.email },
//     });
//   } catch (error) {
//     console.error("Add staff error:", error);
//     return NextResponse.json(
//       { error: "Internal Server Error" },
//       { status: 500 }
//     );
//   }
// }
