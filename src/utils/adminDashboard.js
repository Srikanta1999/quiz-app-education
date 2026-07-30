import { CATEGORIES } from '../constants';

const isMeaningfulValue = value => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue !== '' && trimmedValue.toUpperCase() !== 'N/A';
  }
  return true;
};

const pickMeaningfulValue = (...values) => {
  for (const value of values) {
    if (isMeaningfulValue(value)) {
      return value;
    }
  }
  return null;
};

export const getStudentAttemptDisplayData = student => {
  if (!student || typeof student !== 'object') {
    return { category: 'N/A', scoreText: 'N/A', lastAttempt: null };
  }

  const attempts = Array.isArray(student.attempts) ? student.attempts : [];
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

  const derivedCategory = pickMeaningfulValue(lastAttempt?.category, student.lastCategory, student.category);
  const derivedScoreText = pickMeaningfulValue(student.lastScoreText, getAttemptScoreText(lastAttempt));

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
