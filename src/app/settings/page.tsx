import { AppShell } from "@/components/AppShell";
import { SettingsPage } from "@/components/settings/SettingsPage";

/**
 * Everything that is plumbing rather than taste (SPEC v5 → Settings page).
 * Reached from the account row at the bottom of the rail, which is why it
 * keeps the rail.
 */
export default function Settings() {
  return (
    <AppShell>
      <SettingsPage />
    </AppShell>
  );
}
