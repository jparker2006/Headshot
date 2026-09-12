import { redirect } from "next/navigation";

/** Onboarding starts at the first step; `/welcome` is only the door. */
export default function Welcome() {
  redirect("/welcome/services");
}
