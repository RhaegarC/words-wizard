import type { Metadata } from "next"
import AdminPortal from "@/portals/admin/AdminPortal"

export const metadata: Metadata = {
  title: "Words Wizard Admin",
  description: "Vocabulary management for Words Wizard teachers and administrators",
}

export default function StaffPortalPage() {
  return <AdminPortal />
}
