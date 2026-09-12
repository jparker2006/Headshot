"use client";
/** Step one: what you pay for, so tonight only ever picks something you can open. */
import { useRouter } from "next/navigation";
import { ServicesChecklist } from "@/components/settings/ServicesChecklist";
import { WelcomeStep } from "@/components/welcome/WelcomeStep";
import { nextHref } from "@/components/welcome/welcomeModel";

export default function WelcomeServices() {
  const router = useRouter();
  return (
    <WelcomeStep step="services" title="what do you pay for?" line="tonight only picks things you can open.">
      <ServicesChecklist heading={null} intro onSaved={() => router.push(nextHref("services"))} />
    </WelcomeStep>
  );
}
