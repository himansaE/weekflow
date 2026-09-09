import { ManagerReview } from '@/features/reports/manager-review';

export default async function Page({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <ManagerReview reportId={reportId} />;
}
