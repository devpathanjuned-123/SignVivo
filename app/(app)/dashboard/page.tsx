import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { formatDate } from "@/lib/utils";
import UploadButton from "@/components/UploadButton";
import type { DocumentStatus } from "@/types/database";

interface DashboardDoc {
  id: string;
  title: string;
  status: DocumentStatus;
  created_at: string;
  recipients: Array<{ id: string; email: string }>;
}

const statusStyles: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  VOIDED: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const workspaceId = await getDefaultWorkspaceId(supabase);

  let docs: DashboardDoc[] = [];
  if (workspaceId) {
    const { data } = await supabase
      .from("documents")
      .select("id, title, status, created_at, recipients(id, email)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    docs = (data ?? []) as unknown as DashboardDoc[];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-gray-600">Upload a PDF and send it for signature.</p>
        </div>
        <UploadButton />
      </div>

      {!workspaceId ? (
        <div className="card p-8 text-sm text-red-700">
          We couldn't find your workspace. Try signing out and back in.
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-12 text-center">
          <h2 className="font-medium mb-2">No documents yet</h2>
          <p className="text-sm text-gray-600 mb-6">Upload a PDF to get started.</p>
          <UploadButton />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {docs.map((d) => {
                const href = d.status === "DRAFT" ? `/documents/${d.id}/edit` : `/documents/${d.id}`;
                const emails = (d.recipients ?? []).map((r) => r.email);
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={href} className="hover:underline">{d.title}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emails.length === 0 ? "—" : emails.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={href} className="text-brand-600 hover:underline text-sm">Open →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
