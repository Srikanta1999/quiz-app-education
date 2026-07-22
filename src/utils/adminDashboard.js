import { CATEGORIES } from '../constants';

export const getStudentAttemptDisplayData = student => {
  if (!student || typeof student !== 'object') {
    return { category: 'N/A', scoreText: 'N/A', lastAttempt: null };
  }

  const attempts = Array.isArray(student.attempts) ? student.attempts : [];
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

  const derivedCategory = student.lastCategory ?? student.category ?? lastAttempt?.category;
  const derivedScoreText = student.lastScoreText ?? getAttemptScoreText(lastAttempt);

  return {
    category: getCategoryLabel(derivedCategory),
    scoreText: derivedScoreText || getAttemptScoreText(lastAttempt),
    lastAttempt,
  };
};

export const getCategoryLabel = category => {
  if (category === undefined || category === null || category === '') return 'N/A';

  const normalizedCategory = String(category).trim();
  if (!normalizedCategory) return 'N/A';

  const foundCategory = CATEGORIES.find(c =>
    String(c.value) === normalizedCategory ||
    String(c.key) === normalizedCategory ||
    String(c.text).toLowerCase() === normalizedCategory.toLowerCase()
  );

  return foundCategory ? foundCategory.text : normalizedCategory;
};

export const getAttemptScoreText = attempt => {
  if (!attempt || typeof attempt !== 'object') return 'N/A';

  const correctAnswers = attempt.correctAnswers ?? attempt.correct ?? attempt.score ?? attempt.correctCount;
  const totalQuestions = attempt.totalQuestions ?? attempt.total ?? attempt.totalCount;

  if (correctAnswers === undefined || totalQuestions === undefined || correctAnswers === null || totalQuestions === null) {
    return 'N/A';
  }

  return `${correctAnswers}/${totalQuestions}`;
};
