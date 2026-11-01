import ExamIndex from './ExamIndex';
import ExamPage from './ExamPage';
import ExamSubjectPage from './ExamSubjectPage';
import { getExam } from './examData';
import type { ExamRoute } from './examRoute';

interface ExamRouteViewProps {
  route: ExamRoute;
  brandName: string;
  logoUrl: string;
}

export default function ExamRouteView({ route, brandName, logoUrl }: ExamRouteViewProps) {
  if (route.kind === 'exam-index') {
    return <ExamIndex brandName={brandName} logoUrl={logoUrl} />;
  }

  const exam = getExam(route.kind === 'exam-page' ? route.slug : route.examSlug);
  if (!exam) {
    window.location.hash = '#/exam';
    return <ExamIndex brandName={brandName} logoUrl={logoUrl} />;
  }

  if (route.kind === 'exam-page') {
    return <ExamPage exam={exam} brandName={brandName} logoUrl={logoUrl} />;
  }

  const subject = exam.subjects.find((item) => item.slug === route.subjectSlug);
  if (!subject) {
    window.location.hash = `#/exam/${exam.slug}`;
    return <ExamPage exam={exam} brandName={brandName} logoUrl={logoUrl} />;
  }

  return <ExamSubjectPage exam={exam} subject={subject} brandName={brandName} logoUrl={logoUrl} />;
}
