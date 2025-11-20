// app/services/page.tsx
//
// Purpose
// -------
// Guarantee the correct flow from Services → Sign-up → Payment (then back to dashboard)
// without modifying PricingCardSection or other files.
// We do this via lightweight, defensive event delegation on the #pricing section.
//
// How it works
// ------------
// - We attach a single click listener on the pricing container.
// - When a user clicks a CTA that *appears* to select the INDIVIDUAL or BUSINESS plan,
//   we prevent any default "go-to-checkout" behavior and redirect to the Sign-up page:
//   • /signup?from=services&package=individual
//   • /signup?from=services&package=business
//
// Why event delegation?
// ---------------------
// We don't have the PricingCardSection props/implementation here and were asked
// not to change other components. Delegation lets us enforce the flow centrally,
// with minimal risk and zero changes elsewhere.
//
// Safety / Robustness
// -------------------
// - We only intercept clicks if we can confidently infer the package from:
//     • explicit data attributes (data-package / data-plan / data-package-type)
//     • id/class hints containing "individual" or "business" (case-insensitive)
//     • button/link text content that clearly includes "individual"/"business"
// - Otherwise, we do nothing (no interference).
//
// Pillars
// -------
// - Efficiency: single event listener; no re-renders.
// - Robustness: multiple detection heuristics, null-safe, no crashes.
// - Simplicity: small, well-commented function.
// - Ease of management: change detection keywords in one place.
// - Security: client-side only; server remains source of truth post-signup/checkout.

"use client";

import TopofPageContent from "@/components/topPage/topOfPageStyle";
import PricingCardSection from "@/components/pricingCards/pricingCards";
import { MouseEvent, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import SearchParamsWrapper from "@/components/utils/searchParamsWrapper";

function ServicesToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // ✅ Null-safe reads
    const success = (searchParams?.get("success") ?? "") === "true";
    const canceled = (searchParams?.get("canceled") ?? "") === "true";
    const error = searchParams?.get("error") ?? "";

    if (success) {
      toast.success("🎉 Payment successful! You now have access.", { duration: 3000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (canceled) {
      toast.error("❌ Payment canceled. No changes made.", { duration: 3000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (error) {
      toast.error(`⚠️ Payment failed: ${error}`, { duration: 8000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [searchParams]);

  return null;
}

function ServicesContent() {
  const handleScrollToPricing = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const pricingSection = document.querySelector<HTMLDivElement>("#pricing");
    pricingSection?.scrollIntoView({ behavior: "smooth" });
  };

  // ------------------------------------------------------------
  // Event delegation: intercept "select plan" clicks inside #pricing
  // and route to the Sign-up page instead of going straight to payment.
  // ------------------------------------------------------------
  useEffect(() => {
    const container = document.getElementById("pricing");
    if (!container) return;

    // Helpers: detect plan type from element context
    const inferPackageFromEl = (el: Element | null): "individual" | "business" | null => {
      if (!el || !(el instanceof HTMLElement)) return null;

      // 1) Direct data-attributes (preferred & explicit)
      const dataPkg =
        el.getAttribute("data-package") ||
        el.getAttribute("data-plan") ||
        el.getAttribute("data-package-type");
      if (dataPkg) {
        const v = dataPkg.toLowerCase();
        if (v.includes("business")) return "business";
        if (v.includes("individual") || v.includes("personal")) return "individual";
      }

      // 2) Heuristics via id/className for common naming
      const idCls = `${el.id} ${el.className}`.toLowerCase();
      if (idCls.includes("business")) return "business";
      if (idCls.includes("individual") || idCls.includes("personal")) return "individual";

      // 3) Visible text content fallback (last resort, but often works)
      const text = el.textContent?.toLowerCase() || "";
      // Look for words that imply picking the business or individual plan
      if (/\bbusiness\b/.test(text)) return "business";
      if (/\bindividual\b|\bpersonal\b/.test(text)) return "individual";

      return null;
    };

    // Actual click handler
    const onClick = (evt: MouseEvent) => {
      // Only intercept left-clicks without modifier keys
      const mouseEvt = evt as unknown as globalThis.MouseEvent;
      if (mouseEvt.button !== 0 || mouseEvt.metaKey || mouseEvt.ctrlKey || mouseEvt.shiftKey || mouseEvt.altKey) {
        return;
      }

      // Find the closest actionable element the user clicked:
      const target = evt.target as Element | null;
      if (!target) return;

      // Anchor or button (typical CTA containers)
      const actionable =
        target.closest<HTMLAnchorElement>("a[href]") ||
        target.closest<HTMLButtonElement>("button") ||
        target.closest<HTMLElement>("[role='button']");

      if (!actionable) return;

      // Make sure the element is inside the pricing cards area
      if (!container.contains(actionable)) return;

      // Try to infer the plan/package from the actionable element or its parent card
      const pkg =
        inferPackageFromEl(actionable) ||
        inferPackageFromEl(actionable.parentElement) ||
        inferPackageFromEl(actionable.closest("[data-card]")) ||
        null;

      if (!pkg) return; // Not a recognized select-plan click → do nothing

      // ✅ We recognized a plan selection — enforce the correct flow:
      //    Services → Sign-up → Payment → Dashboard
      evt.preventDefault();
      evt.stopPropagation();

      const url = `/signup?from=services&package=${pkg}`;
      window.location.href = url;
    };

    // Attach listener
    container.addEventListener("click", onClick as unknown as EventListener, { capture: true });

    // Cleanup
    return () => {
      container.removeEventListener("click", onClick as unknown as EventListener, { capture: true });
    };
  }, []); // run once

  return (
    <main className="m-0 p-0">
      <TopofPageContent
        HeadingOneTitle="Services"
        paragraphContent="We offer cultural awareness course packages focused on the Nyanbul people of the Bundjalung nation from Ballina/Bullinah."
        linkOne="Prices Below"
        href="#pricing"
        onClick={handleScrollToPricing}
        imageSrc="/images/stingray and green sea turtle logo.png"
        imageAlt="Aboriginal style image of a Stingray"
      />

      {/* 
        IMPORTANT: 
        Keep the original component unchanged. Our event delegation above
        guarantees that any "select plan" action routes users via the Sign-up flow. 
      */}
      <PricingCardSection />
    </main>
  );
}

export default function ServicesPage() {
  return (
    <SearchParamsWrapper>
      {/* Toast handler for Stripe redirects */}
      <ServicesToastHandler />
      <ServicesContent />
    </SearchParamsWrapper>
  );
}
