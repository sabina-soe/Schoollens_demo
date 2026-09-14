import { NetworkMap } from "./network-map";

export default async function NetworkPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <NetworkMap groupId={groupId} />;
}
