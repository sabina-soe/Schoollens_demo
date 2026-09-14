import { SchoolProfile } from "./school-profile";

export default async function SchoolProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SchoolProfile id={id} />;
}
