import { ConflictView } from "./conflict-view";

export default async function ConflictPage({
  params,
}: {
  params: Promise<{ id: string; groupId: string }>;
}) {
  const { id, groupId } = await params;
  return <ConflictView schoolId={id} groupId={groupId} />;
}
