"use client";

import { SettingsDashboard } from "@/components/dashboard/settings-dashboard";
import { RequireAuth } from "@/components/providers/require-auth";

export default function SettingsPage() {
 return (
 <RequireAuth>
 <SettingsDashboard />
 </RequireAuth>
 );
}
