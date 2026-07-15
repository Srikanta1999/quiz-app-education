import { CATEGORIES } from '../constants';

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
