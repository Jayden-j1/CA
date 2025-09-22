// components/providers/SessionProviderWrapper.tsx
//
// Purpose:
// - Wraps NextAuth's SessionProvider around your app.
// - Allows hooks like useSession() to work anywhere in the app.
// - Must be a "use client" component because providers are client-only.

"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function SessionProviderWrapper({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
}
