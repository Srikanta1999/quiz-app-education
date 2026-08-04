import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Container,
  Segment,
  Button,
  Message,
  Menu,
  Header,
  Form,
  Dropdown,
  Table,
  Icon,
  Statistic,
  Modal,
  Image,
  Divider,
} from 'semantic-ui-react';

import Layout from '../Layout';
import Loader from '../Loader';
import Main from '../Main';
import Quiz from '../Quiz';
import Result from '../Result';
import CameraCapture from '../CameraCapture';

import { CATEGORIES, NUM_OF_QUESTIONS, COUNTDOWN_TIME } from '../../constants';
import { createRequestDeduper, shuffle, getCategoryLabel, getAttemptScoreText, getStudentAttemptDisplayData, buildApiUrl } from '../../utils';

const defaultQuizSettings = [
  {
    id: 'quiz1',
    name: 'Aptitude Quiz',
    category: '9',
    numOfQuestions: 5,
    countdownSeconds: 120,
    examPassword: '',
  },
];

const API_URL = buildApiUrl('');

const CACHE_VERSION = 'quiz-app-v2';
const MAX_PERSISTED_PHOTO_BYTES = 220 * 1024;

const clearStaleAppCache = () => {
  if (typeof window === 'undefined') return;

  try {
    const storedVersion = window.localStorage.getItem('quizAppCacheVersion');
    if (storedVersion === CACHE_VERSION) return;

    const cacheKeys = ['quizStudentHistory', 'quizStudentPhotos', 'quizPendingStudentPhotos', 'quizSettings'];
    cacheKeys.forEach(key => window.localStorage.removeItem(key));
    window.localStorage.setItem('quizAppCacheVersion', CACHE_VERSION);
  } catch (error) {
    console.warn('Unable to reset stale app cache:', error);
  }
};

const sanitizeStoredPhotoMap = photoMap => {
  if (!photoMap || typeof photoMap !== 'object') return {};

  return Object.entries(photoMap).reduce((acc, [registrationNo, photo]) => {
    if (!photo || typeof photo !== 'string') return acc;
    if (photo.length > MAX_PERSISTED_PHOTO_BYTES) return acc;
    acc[registrationNo] = photo;
    return acc;
  }, {});
};

const getStoredHistory = () => {
  clearStaleAppCache();
  try {
    const stored = window.localStorage.getItem('quizStudentHistory');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const getStoredPhotos = () => {
  clearStaleAppCache();
  try {
    const stored = window.localStorage.getItem('quizStudentPhotos');
    return stored ? sanitizeStoredPhotoMap(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
};

const getStoredPendingPhotos = () => {
  clearStaleAppCache();
  try {
    const stored = window.localStorage.getItem('quizPendingStudentPhotos');
    return stored ? sanitizeStoredPhotoMap(JSON.parse(stored)) : {};
  } catch {
    return {};
  }
};

const getStoredQuizSettings = () => {
  clearStaleAppCache();
  try {
    const stored = window.localStorage.getItem('quizSettings');
    return stored ? JSON.parse(stored) : defaultQuizSettings;
  } catch {
    return defaultQuizSettings;
  }
};

const getStoredQuizSession = registrationNo => {
  try {
    if (!registrationNo || typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(`quizSession_${registrationNo}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const saveQuizSessionToStorage = (registrationNo, session) => {
  try {
    if (!registrationNo || typeof window === 'undefined') return;
    window.localStorage.setItem(`quizSession_${registrationNo}`, JSON.stringify(session));
  } catch (error) {
    console.warn('Failed to save quiz session:', error);
  }
};

const clearStoredQuizSession = registrationNo => {
  try {
    if (!registrationNo || typeof window === 'undefined') return;
    window.localStorage.removeItem(`quizSession_${registrationNo}`);
  } catch (error) {
    console.warn('Failed to clear quiz session:', error);
  }
};

const fetchServerQuizSession = async registrationNo => {
  if (!registrationNo) return null;
  const response = await fetch(`${API_URL}/quiz-session/${encodeURIComponent(registrationNo)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-cache',
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.success ? payload.session : null;
};

const saveServerQuizSession = async (registrationNo, session) => {
  if (!registrationNo || !session) return null;
  const response = await fetch(`${API_URL}/quiz-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationNo, session }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.success ? payload.session : null;
};

const deleteServerQuizSession = async registrationNo => {
  if (!registrationNo) return false;
  const response = await fetch(`${API_URL}/quiz-session/${encodeURIComponent(registrationNo)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  return response.ok;
};

const Login = ({ onLogin, onAdminLogin, onHodLogin, hodLoggedIn = false }) => {
  const [name, setName] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [isFaculty, setIsFaculty] = useState(false);
  const [isHod, setIsHod] = useState(false);
  const [password, setPassword] = useState('');
  const [hodUsername, setHodUsername] = useState('');
  const [hodPassword, setHodPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (isFaculty) {
      if (!password.trim()) {
        setError('Please enter the faculty password.');
        return;
      }

      if (password !== 'Srikanta123') {
        setError('Incorrect faculty password.');
        return;
      }

      setError(null);
      onAdminLogin();
      return;
    }

    if (isHod) {
      if (!hodUsername.trim() || !hodPassword.trim()) {
        setError('Please enter both HOD username and password.');
        return;
      }

      setError(null);
      const success = await onHodLogin({ username: hodUsername.trim(), password: hodPassword });
      if (!success) {
        setError('Invalid HOD credentials.');
      }
      return;
    }

    if (!name.trim() || !registrationNo.trim()) {
      setError('Please enter both name and registration number to continue.');
      return;
    }

    setError(null);
    onLogin({ name: name.trim(), registrationNo: registrationNo.trim() });
  };

  return (
    <Container>
      <Segment>
        <Header as="h1">
          {isFaculty ? 'Admin Login' : isHod ? 'HOD Login' : 'Student Login'}
        </Header>
        <p>
          {isFaculty
            ? 'Enter the faculty password to open the dashboard.'
            : isHod
            ? 'Enter your HOD username and password to access the admin dashboard.'
            : 'Enter your name and registration number to track logins and quiz scores.'}
        </p>

        <Form error={!!error} onSubmit={handleSubmit}>
          {!isFaculty && !isHod && (
            <>
              <Form.Input
                fluid
                label="Student name"
                placeholder="Enter your full name"
                value={name}
                onChange={(e, { value }) => setName(value)}
              />
              <Form.Input
                fluid
                label="Registration no."
                placeholder="Enter your registration number"
                value={registrationNo}
                onChange={(e, { value }) => setRegistrationNo(value)}
              />
            </>
          )}

          {isFaculty && (
            <Form.Input
              fluid
              type="password"
              label="Faculty password"
              placeholder="Faculty password"
              value={password}
              onChange={(e, { value }) => setPassword(value)}
            />
          )}

          {isHod && (
            <>
              <Form.Input
                fluid
                label="HOD username"
                placeholder="Enter your HOD username"
                value={hodUsername}
                onChange={(e, { value }) => setHodUsername(value)}
              />
              <Form.Input
                fluid
                type="password"
                label="HOD password"
                placeholder="Enter your HOD password"
                value={hodPassword}
                onChange={(e, { value }) => setHodPassword(value)}
              />
            </>
          )}

          {error && <Message error header="Validation error" content={error} />}

          <Button
            primary
            size="large"
            content={isFaculty ? 'Login as faculty' : isHod ? 'Login as HOD' : 'Continue'}
          />
        </Form>

        <div style={{ marginTop: '1rem' }}>
          {!isFaculty && !isHod && (
            <>
              <Button
                color="purple"
                icon="user secret"
                content="Admin login"
                onClick={() => {
                  setIsFaculty(true);
                  setIsHod(false);
                  setError(null);
                  setPassword('');
                }}
              />
              {/* Show HOD login option only when there are HOD accounts and none is logged in */}
              <Button
                color="teal"
                icon="shield alternate"
                content="HOD login"
                onClick={() => {
                  if (hodLoggedIn) {
                    setError('An HOD is already logged in.');
                    return;
                  }

                  setIsHod(true);
                  setIsFaculty(false);
                  setError(null);
                  setHodUsername('');
                  setHodPassword('');
                }}
                style={{ marginLeft: '0.5rem' }}
                disabled={hodLoggedIn}
                title={hodLoggedIn ? 'An HOD is already logged in' : 'Login as HOD'}
              />
            </>
          )}

          {(isFaculty || isHod) && (
            <Button
              basic
              onClick={() => {
                setIsFaculty(false);
                setIsHod(false);
                setError(null);
                setPassword('');
                setHodUsername('');
                setHodPassword('');
              }}
            >
              Back to student login
            </Button>
          )}
        </div>
      </Segment>
    </Container>
  );
};

const Monitor = ({ student, history, onBack }) => {
  const studentHistory = history[student.registrationNo] || {
    logins: 0,
    attempts: [],
  };
  const attempts = studentHistory.attempts || [];
  const averageScore = attempts.length
    ? Math.round(
        attempts.reduce((total, attempt) => {
          if (!attempt.totalQuestions) return total;
          return total + (attempt.correctAnswers / attempt.totalQuestions) * 100;
        }, 0) / attempts.length
      )
    : 0;

  return (
    <Container>
      <Segment>
        <Header as="h1">Student Monitor</Header>
        <p>
          <strong>Student:</strong> {student.name}
        </p>
        <p>
          <strong>Registration no.:</strong> {student.registrationNo}
        </p>
        <p>
          <strong>Login count:</strong> {studentHistory.logins}
        </p>
        <p>
          <strong>Total quiz attempts:</strong> {attempts.length}
        </p>
        {attempts.length > 0 && (
          <p>
            <strong>Average score:</strong> {averageScore}%
          </p>
        )}

        {attempts.length === 0 ? (
          <Message info>
            <Message.Header>No quiz history yet</Message.Header>
            <p>Complete a quiz to start recording your scores.</p>
          </Message>
        ) : (
          <Table celled compact selectable size="large">
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Score</Table.HeaderCell>
                <Table.HeaderCell>Percent</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {attempts.map((attempt, index) => {
                const percentage = attempt.totalQuestions
                  ? Math.round((attempt.correctAnswers / attempt.totalQuestions) * 100)
                  : 0;

                return (
                  <Table.Row key={`${attempt.date}-${index}`}>
                    <Table.Cell>{new Date(attempt.date).toLocaleString()}</Table.Cell>
                    <Table.Cell>
                      {attempt.correctAnswers}/{attempt.totalQuestions}
                    </Table.Cell>
                    <Table.Cell>{percentage}%</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        )}

        <Button primary onClick={onBack} style={{ marginTop: '1rem' }}>
          Back to home
        </Button>
      </Segment>
    </Container>
  );
};

const AdminPanel = ({ history, onLogout, isOnline, apiUrl, studentPhotos, quizSettings, onSaveSettings, hodLoggedIn = false }) => {
  const [sortOrder, setSortOrder] = useState('desc');
  const [students, setStudents] = useState(() => Object.values(history || []));
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lastSynced, setLastSynced] = useState(new Date());
  const [showScores, setShowScores] = useState(false);
  const [selectedStudentCategory, setSelectedStudentCategory] = useState('0');
  const [selectedStudentQuizName, setSelectedStudentQuizName] = useState('');
  const [quizzes, setQuizzes] = useState(quizSettings && Array.isArray(quizSettings) ? quizSettings : [
    {
      id: 'quiz1',
      name: 'Aptitude Quiz',
      category: '9',
      numOfQuestions: 5,
      countdownSeconds: 120,
      examPassword: '',
    },
  ]);
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [hodModalOpen, setHodModalOpen] = useState(false);
  const [hods, setHods] = useState([]);
  const [hodUsername, setHodUsername] = useState('');
  const [hodPassword, setHodPassword] = useState('');
  const [hodError, setHodError] = useState(null);
  const [hodLoading, setHodLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const adminDataDeduperRef = useRef(null);

  if (!adminDataDeduperRef.current) {
    adminDataDeduperRef.current = createRequestDeduper();
  }

  useEffect(() => {
    if (quizSettings && Array.isArray(quizSettings)) {
      setQuizzes(quizSettings);
    }
  }, [quizSettings]);

  const handleAddQuiz = () => {
    const newQuiz = {
      id: `quiz${Date.now()}`,
      name: 'New Quiz',
      category: '9',
      numOfQuestions: 5,
      countdownSeconds: 120,
      examPassword: '',
    };
    const updatedQuizzes = [...quizzes, newQuiz];
    setQuizzes(updatedQuizzes);
    if (onSaveSettings) {
      onSaveSettings(updatedQuizzes);
    }
    setEditingQuizId(newQuiz.id);
    setEditForm(newQuiz);
  };

  const handleEditQuiz = (quiz) => {
    setEditingQuizId(quiz.id);
    setEditForm({ ...quiz });
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveQuiz = () => {
    const updatedQuizzes = quizzes.map(q => q.id === editingQuizId ? editForm : q);
    setQuizzes(updatedQuizzes);
    if (onSaveSettings) {
      onSaveSettings(updatedQuizzes);
    }
    setEditingQuizId(null);
    setEditForm({});
  };

  const handleDeleteQuiz = (quizId) => {
    if (window.confirm('Delete this quiz? This cannot be undone.')) {
      const updated = quizzes.filter(q => q.id !== quizId);
      setQuizzes(updated);
      if (onSaveSettings) {
        onSaveSettings(updated);
      }
      if (editingQuizId === quizId) {
        setEditingQuizId(null);
        setEditForm({});
      }
    }
  };

  const handleCreateHod = async () => {
    if (!isOnline || !apiUrl) {
      setHodError('Cannot create HOD while offline.');
      return;
    }

    if (!hodUsername.trim() || !hodPassword.trim()) {
      setHodError('Please enter both HOD username and password.');
      return;
    }

    setHodLoading(true);
    setHodError(null);

    try {
      const response = await fetch(`${apiUrl}/hods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: hodUsername.trim(), password: hodPassword.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create HOD');
      }
      setHods(Array.isArray(payload.hods) ? payload.hods : hods);
      setHodUsername('');
      setHodPassword('');
      setHodError(null);
    } catch (createError) {
      console.error('Create HOD failed:', createError);
      setHodError(createError.message?.includes('Failed to fetch')
        ? 'Unable to connect to the backend server. Make sure the API server is running.'
        : createError.message || 'Unable to create HOD account.');
    }

    setHodLoading(false);
  };

  const handleDeleteHod = async (username) => {
    if (!window.confirm(`Delete HOD account ${username}? This cannot be undone.`)) {
      return;
    }
    if (!isOnline || !apiUrl) {
      setHodError('Cannot delete HOD while offline.');
      return;
    }

    setHodLoading(true);
    setHodError(null);

    try {
      const response = await fetch(`${apiUrl}/hods/${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to delete HOD');
      }
      setHods(prev => prev.filter(hod => hod.username !== username));
    } catch (deleteError) {
      console.error('Delete HOD failed:', deleteError);
      setHodError(deleteError.message?.includes('Failed to fetch')
        ? 'Unable to connect to the backend server. Make sure the API server is running.'
        : deleteError.message || 'Unable to delete HOD account.');
    }

    setHodLoading(false);
  };

  const formatTimer = seconds => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const filterHistoryStudents = useCallback(studentsList => {
    const categoryFilter = selectedStudentCategory && selectedStudentCategory !== '0';
    const quizNameFilter = selectedStudentQuizName && selectedStudentQuizName.trim() !== '';
    const normalizedQuizName = quizNameFilter ? selectedStudentQuizName.trim().toLowerCase() : '';

    return studentsList.filter(student => {
      if (!categoryFilter && !quizNameFilter) return true;

      const attempts = student.attempts || [];
      return attempts.some(attempt => {
        const categoryMatches = !categoryFilter || String(attempt.category) === String(selectedStudentCategory);
        const quizNameMatches = !quizNameFilter || String(attempt.quizName || '').toLowerCase().includes(normalizedQuizName);
        return categoryMatches && quizNameMatches;
      });
    });
  }, [selectedStudentCategory, selectedStudentQuizName]);

  const computeSummaryFromStudents = studentsList => {
    const totalAttempts = studentsList.reduce((sum, student) => sum + ((student.attempts || []).length), 0);
    const totalScore = studentsList.reduce((sum, student) => {
      const attempts = student.attempts || [];
      if (!attempts.length) return sum;
      const lastAttempt = attempts[attempts.length - 1];
      if (!lastAttempt.totalQuestions) return sum;
      return sum + (lastAttempt.correctAnswers / lastAttempt.totalQuestions) * 100;
    }, 0);
    return {
      totalStudents: studentsList.length,
      totalAttempts,
      averageScore: studentsList.length ? Math.round(totalScore / studentsList.length) : 0,
    };
  };

  const fetchAdminData = useCallback(async () => {
    const historyStudents = filterHistoryStudents(Object.values(history || {}));

    if (!isOnline || !apiUrl) {
      if (historyStudents.length > 0) {
        setStudents(historyStudents);
        setSummary(computeSummaryFromStudents(historyStudents));
        setError(null);
      } else {
        setError('Admin panel requires server connection');
        setStudents([]);
        setSummary(null);
      }
      setLoading(false);
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    const requestKey = `${apiUrl}:${selectedStudentCategory || 'all'}:${selectedStudentQuizName || 'all'}`;

    try {
      await adminDataDeduperRef.current(requestKey, async () => {
        const queryParts = [];
        if (selectedStudentCategory && selectedStudentCategory !== '0') {
          queryParts.push(`category=${encodeURIComponent(selectedStudentCategory)}`);
        }
        if (selectedStudentQuizName && selectedStudentQuizName.trim() !== '') {
          queryParts.push(`quizName=${encodeURIComponent(selectedStudentQuizName.trim())}`);
        }
        const query = queryParts.length ? `?${queryParts.join('&')}` : '';
        const studentsResponse = await fetch(`${apiUrl}/students${query}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!studentsResponse.ok) {
          const payload = await studentsResponse.json();
          throw new Error(payload.error || `Server error: ${studentsResponse.status}`);
        }

        const studentsData = await studentsResponse.json();
        setStudents(Array.isArray(studentsData.students) ? studentsData.students : []);

        const summaryResponse = await fetch(`${apiUrl}/export/summary`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setSummary(summaryData.summary || null);
        }
      });
    } catch (fetchError) {
      console.error('Error fetching admin data:', fetchError);
      if (historyStudents.length > 0) {
        setStudents(historyStudents);
        setSummary(computeSummaryFromStudents(historyStudents));
        setError(null);
      } else {
        setError(`Connection error: ${fetchError.message}`);
        setStudents([]);
        setSummary(null);
      }
    } finally {
      setLastSynced(new Date());
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [apiUrl, filterHistoryStudents, history, isOnline, selectedStudentCategory, selectedStudentQuizName]);

  const fetchHods = useCallback(async () => {
    if (!isOnline || !apiUrl) {
      setHodError('HOD management requires server connection');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/hods`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Unable to fetch HODs');
      }

      const payload = await response.json();
      setHods(Array.isArray(payload.hods) ? payload.hods : []);
      setHodError(null);
    } catch (fetchError) {
      console.error('Error fetching HODs:', fetchError);
      setHodError('Unable to load HOD accounts.');
    }
  }, [apiUrl, isOnline]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  useEffect(() => {
    if (!isOnline || !apiUrl) return undefined;

    const intervalId = window.setInterval(() => {
      fetchAdminData();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [apiUrl, fetchAdminData, isOnline]);

  useEffect(() => {
    const handleSync = () => {
      fetchAdminData();
    };

    window.addEventListener('quiz-sync', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      window.removeEventListener('quiz-sync', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [fetchAdminData]);

  useEffect(() => {
    if (isOnline) {
      fetchHods();
    }
  }, [fetchHods, isOnline]);

  useEffect(() => {
    if (!isOnline || !apiUrl) return undefined;
    fetchAdminData();
  }, [fetchAdminData, isOnline, apiUrl]);

  const sortedStudents = [...students].sort((a, b) => {
    const aAttempts = a.attempts || [];
    const bAttempts = b.attempts || [];
    const aLast = aAttempts.length
      ? (aAttempts[aAttempts.length - 1].correctAnswers / aAttempts[aAttempts.length - 1].totalQuestions) * 100
      : -1;
    const bLast = bAttempts.length
      ? (bAttempts[bAttempts.length - 1].correctAnswers / bAttempts[bAttempts.length - 1].totalQuestions) * 100
      : -1;

    return sortOrder === 'asc' ? aLast - bLast : bLast - aLast;
  });

  const displayedStudents = showScores
    ? sortedStudents.filter(student => (student.attempts || []).length > 0)
    : sortedStudents;

  const quizNameOptions = Array.from(
    new Set(quizzes.map(q => q.name).filter(Boolean))
  ).map(name => ({ key: name, value: name, text: name }));

  const handleDeleteStudent = async registrationNo => {
    if (!registrationNo) {
      setError('Student registration number is missing.');
      return;
    }

    if (!window.confirm(`Delete student ${registrationNo}? This cannot be undone.`)) {
      return;
    }

    if (!apiUrl) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/students/${encodeURIComponent(registrationNo)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || `Failed to delete student: ${response.status}`);
      }

      setStudents(prev => prev.filter(student => student.registrationNo !== registrationNo));
      setSummary(prev => prev ? {
        ...prev,
        totalStudents: Math.max(0, prev.totalStudents - 1),
        totalAttempts: Math.max(0, prev.totalAttempts - 1),
      } : prev);

      try {
        window.dispatchEvent(new Event('quiz-sync'));
      } catch (eventError) {
        console.warn('Unable to dispatch refresh event:', eventError);
      }

      await fetchAdminData();
    } catch (deleteError) {
      console.error('Error deleting student:', deleteError);
      setError(`Delete failed: ${deleteError.message}`);
    }

    setLoading(false);
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all students and reset student activity? This cannot be undone.')) {
      return;
    }

    if (!apiUrl) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/students`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || `Failed to delete all students: ${response.status}`);
      }

      setStudents([]);
      setSummary({ totalStudents: 0, totalAttempts: 0, averageScore: 0 });

      try {
        window.dispatchEvent(new Event('quiz-sync'));
      } catch (eventError) {
        console.warn('Unable to dispatch refresh event:', eventError);
      }

      await fetchAdminData();
    } catch (deleteError) {
      console.error('Error deleting all students:', deleteError);
      setError(`Delete all failed: ${deleteError.message}`);
    }

    setLoading(false);
  };

  const totalAttempts = students.reduce((sum, student) => sum + ((student.attempts || []).length), 0);
  const totalStudents = students.length;
  const classAverage = summary?.averageScore ??
    (students.length > 0
      ? Math.round(
          students.reduce((sum, student) => {
            const attempts = student.attempts || [];
            if (!attempts.length) return sum;
            const last = attempts[attempts.length - 1];
            return sum + (last.correctAnswers / last.totalQuestions) * 100;
          }, 0) / students.length
        )
      : 0);

  return (
    <Container>
      <Segment>
        <Header as="h1" style={{ fontSize: '2.8rem' }}>
          Student Exam Dashboard
        </Header>

        {!isOnline && (
          <Message warning icon>
            <Icon name="wifi" />
            <Message.Content>
              <Message.Header>Offline mode</Message.Header>
              Cannot connect to server. Admin panel requires server connection.
            </Message.Content>
          </Message>
        )}

        {isOnline && !error && (
          <Message positive icon>
            <Icon name="check circle" />
            <Message.Content>
              <Message.Header>Connected to server</Message.Header>
              All devices synchronized in real-time (every 5 seconds).
            </Message.Content>
          </Message>
        )}

        {error && (
          <Message negative icon>
            <Icon name="warning" />
            <Message.Content>
              <Message.Header>Sync Error</Message.Header>
              {error}
            </Message.Content>
          </Message>
        )}

        {(!isOnline || !apiUrl) ? (
          <Message error>
            <Message.Header>Server Connection Required</Message.Header>
            <p>
              The admin panel requires an active connection to the backend server.
            </p>
            <p>
              Please ensure the server is running at:{' '}
              <strong>{apiUrl}</strong>
            </p>
            <Button color="red" onClick={onLogout} style={{ marginTop: '1rem' }}>
              Logout
            </Button>
          </Message>
        ) : loading && students.length === 0 ? (
          <Message info>
            <Message.Header>Loading admin data...</Message.Header>
          </Message>
        ) : students.length === 0 ? (
          <Message info>
            <Message.Header>No student activity yet</Message.Header>
            <p>Student quiz activity will appear here once someone logs in and completes a quiz.</p>
            <Button primary loading={loading} onClick={fetchAdminData} style={{ marginTop: '1rem' }}>
              🔄 Refresh
            </Button>
          </Message>
        ) : (
          <>
            <Statistic.Group widths={3} style={{ marginBottom: '2rem' }}>
              <Statistic>
                <Statistic.Value>{totalStudents}</Statistic.Value>
                <Statistic.Label>Total Students</Statistic.Label>
              </Statistic>
              <Statistic>
                <Statistic.Value>{totalAttempts}</Statistic.Value>
                <Statistic.Label>Total Quiz Attempts</Statistic.Label>
              </Statistic>
              <Statistic>
                <Statistic.Value>{classAverage}%</Statistic.Value>
                <Statistic.Label>Class Average</Statistic.Label>
              </Statistic>
            </Statistic.Group>

            <div style={{ marginBottom: '1rem' }}>
              <Button.Group style={{ marginRight: '1rem' }}>
                <Button active={sortOrder === 'desc'} onClick={() => setSortOrder('desc')}>
                  Sort by last score ↓
                </Button>
                <Button active={sortOrder === 'asc'} onClick={() => setSortOrder('asc')}>
                  Sort by last score ↑
                </Button>
              </Button.Group>
              <Dropdown
                placeholder="Filter students by category"
                selection
                clearable
                options={CATEGORIES}
                value={selectedStudentCategory}
                onChange={(e, { value }) => setSelectedStudentCategory(String(value || '0'))}
                disabled={!isOnline}
                style={{ minWidth: '220px', marginRight: '1rem' }}
              />
              <Dropdown
                placeholder="Filter students by quiz name"
                selection
                search
                clearable
                options={quizNameOptions}
                value={selectedStudentQuizName}
                onChange={(e, { value }) => setSelectedStudentQuizName(String(value || ''))}
                disabled={!isOnline}
                style={{ minWidth: '240px', marginRight: '1rem' }}
              />
              <Button primary onClick={() => setShowScores(prev => !prev)} disabled={!isOnline} style={{ marginRight: '1rem' }}>
                {showScores ? 'Hide student scores' : 'Show student scores'}
              </Button>
              <Button primary onClick={fetchAdminData} loading={loading} disabled={!isOnline}>
                🔄 Refresh Data
              </Button>
              <Button icon="download" content="Export CSV" onClick={() => window.open(`${apiUrl}/export/csv`, '_blank')} disabled={!isOnline} />
              <Button icon="download" content="Export JSON" onClick={() => window.open(`${apiUrl}/export/json`, '_blank')} disabled={!isOnline} />
              <Button negative icon="trash" content="Delete All Students" onClick={handleDeleteAll} disabled={!isOnline || loading || students.length === 0} style={{ marginLeft: '1rem' }} />
              <div style={{ marginTop: '0.5rem', fontSize: '0.85em', color: '#666' }}>
                Last refreshed: {lastSynced.toLocaleTimeString()} (Click "Refresh Data" to update)
              </div>
              {(selectedStudentCategory !== '0' || selectedStudentQuizName !== '') && displayedStudents.length === 0 && students.length > 0 && (
                <Message info style={{ marginTop: '1rem' }}>
                  <Icon name="info" />
                  <Message.Content>
                    <Message.Header>No students match the current filters</Message.Header>
                    <p>
                      {selectedStudentCategory !== '0' && <span>Category filter is active. </span>}
                      {selectedStudentQuizName !== '' && <span>Quiz name filter is active. </span>}
                      Clear filters to see all students or wait for students to complete quizzes matching your filters.
                    </p>
                  </Message.Content>
                </Message>
              )}
            </div>

            <Segment raised>
              <Header as="h2">Quiz Management</Header>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <Button primary onClick={handleAddQuiz} disabled={!isOnline}>
                  + Add New Quiz
                </Button>
                <Button onClick={() => { setHodModalOpen(true); }} disabled={!isOnline || hodLoggedIn}>
                  + Manage HOD Accounts
                </Button>
              </div>

              {quizzes.length === 0 ? (
                <Message info>
                  <Message.Header>{quizzes.length === 0 ? 'No quizzes created yet' : 'No quizzes match this category'}</Message.Header>
                  <p>
                    {quizzes.length === 0
                      ? 'Click "Add New Quiz" to create the first quiz.'
                      : 'Select a different category or clear the filter to see all quizzes.'}
                  </p>
                </Message>
              ) : (
                <Table celled compact selectable>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell>Quiz Name</Table.HeaderCell>
                      <Table.HeaderCell>Category</Table.HeaderCell>
                      <Table.HeaderCell>Questions</Table.HeaderCell>
                      <Table.HeaderCell>Timer</Table.HeaderCell>
                      <Table.HeaderCell>Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {quizzes.map(quiz => {
                      const categoryName = CATEGORIES.find(c => String(c.value) === String(quiz.category))?.text || 'Unknown';
                      return (
                        <Table.Row key={quiz.id}>
                          <Table.Cell>{quiz.name}</Table.Cell>
                          <Table.Cell>{categoryName}</Table.Cell>
                          <Table.Cell>{quiz.numOfQuestions}</Table.Cell>
                          <Table.Cell>{formatTimer(quiz.countdownSeconds)}</Table.Cell>
                          <Table.Cell>
                            <Button
                              size="small"
                              onClick={() => handleEditQuiz(quiz)}
                              disabled={!isOnline}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              negative
                              onClick={() => handleDeleteQuiz(quiz.id)}
                              disabled={!isOnline || quizzes.length === 1}
                            >
                              Delete
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>
              )}

              {editingQuizId && (
                <>
                  <Segment secondary style={{ marginTop: '2rem' }}>
                    <Header as="h3">Edit Quiz</Header>
                    <Form>
                      <Form.Field>
                        <label>Quiz Name</label>
                        <Form.Input
                          fluid
                          placeholder="e.g., Aptitude Quiz"
                          value={editForm.name || ''}
                          onChange={(e) => handleEditFormChange('name', e.target.value)}
                          disabled={!isOnline}
                        />
                      </Form.Field>
                      <Form.Field>
                        <label>Category</label>
                        <Dropdown
                          fluid
                          selection
                          options={CATEGORIES}
                          value={editForm.category || '9'}
                          onChange={(e, { value }) => handleEditFormChange('category', value)}
                          disabled={!isOnline}
                        />
                      </Form.Field>
                      <Form.Field>
                        <label>No. of questions</label>
                        <Dropdown
                          fluid
                          selection
                          options={NUM_OF_QUESTIONS}
                          value={editForm.numOfQuestions || 5}
                          onChange={(e, { value }) => handleEditFormChange('numOfQuestions', value)}
                          disabled={!isOnline}
                        />
                      </Form.Field>
                      <Form.Field>
                        <label>Timer (minutes)</label>
                        <Dropdown
                          fluid
                          selection
                          options={COUNTDOWN_TIME.minutes}
                          value={editForm.countdownSeconds || 120}
                          onChange={(e, { value }) => handleEditFormChange('countdownSeconds', value)}
                          disabled={!isOnline}
                          placeholder="Choose minutes"
                        />
                      </Form.Field>
                      <Form.Field>
                        <label>Exam Password (students will need to enter this to start)</label>
                        <Form.Input
                          fluid
                          type="password"
                          placeholder="Enter exam password"
                          value={editForm.examPassword || ''}
                          onChange={(e) => handleEditFormChange('examPassword', e.target.value)}
                          disabled={!isOnline}
                        />
                      </Form.Field>
                      <Button primary onClick={handleSaveQuiz} disabled={!isOnline}>
                        Save Quiz
                      </Button>
                      <Button onClick={() => { setEditingQuizId(null); setEditForm({}); }}>
                        Cancel
                      </Button>
                      <span style={{ marginLeft: '1rem' }}>
                        Current timer: <strong>{formatTimer(editForm.countdownSeconds || 120)}</strong>
                      </span>
                    </Form>
                  </Segment>
                </>
              )}

              <Modal open={hodModalOpen} onClose={() => { setHodModalOpen(false); setHodError(null); }} size="small">
                <Modal.Header>Manage HOD Accounts</Modal.Header>
                <Modal.Content>
                  <p>Create and manage HOD login accounts. These accounts grant HOD admin access.</p>

                  {hodError && (
                    <Message negative>
                      <Message.Header>HOD error</Message.Header>
                      <p>{hodError}</p>
                    </Message>
                  )}

                  <Form>
                    <Form.Input
                      fluid
                      label="HOD username"
                      placeholder="Enter HOD username"
                      value={hodUsername}
                      onChange={(e, { value }) => setHodUsername(value)}
                      disabled={!isOnline || hodLoading}
                    />
                    <Form.Input
                      fluid
                      type="password"
                      label="HOD password"
                      placeholder="Enter HOD password"
                      value={hodPassword}
                      onChange={(e, { value }) => setHodPassword(value)}
                      disabled={!isOnline || hodLoading}
                    />
                    <Button
                      type="button"
                      primary
                      loading={hodLoading}
                      disabled={!isOnline || hodLoading}
                      onClick={handleCreateHod}
                    >
                      Create HOD account
                    </Button>
                  </Form>

                  <Divider />

                  <Header as="h3">Existing HOD accounts</Header>
                  {hods.length === 0 ? (
                    <Message info>
                      <Message.Header>No HOD accounts yet</Message.Header>
                      <p>Create a new HOD account above to allow HOD login access.</p>
                    </Message>
                  ) : (
                    <Table celled compact>
                      <Table.Header>
                        <Table.Row>
                          <Table.HeaderCell>Username</Table.HeaderCell>
                          <Table.HeaderCell>Action</Table.HeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {hods.map(hod => (
                          <Table.Row key={hod.username}>
                            <Table.Cell>{hod.username}</Table.Cell>
                            <Table.Cell>
                              <Button
                                size="small"
                                negative
                                disabled={!isOnline || hodLoading}
                                onClick={() => handleDeleteHod(hod.username)}
                              >
                                Delete
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                </Modal.Content>
                <Modal.Actions>
                  <Button onClick={() => { setHodModalOpen(false); setHodError(null); }}>
                    Close
                  </Button>
                </Modal.Actions>
              </Modal>
            </Segment>

            {showScores && displayedStudents.length === 0 ? (
              <Message info>
                <Message.Header>No students have appeared in the exam yet.</Message.Header>
                <p>Once a student completes an exam, their score will be displayed here.</p>
              </Message>
            ) : (
              <Table celled compact selectable>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Name</Table.HeaderCell>
                    <Table.HeaderCell>Registration #</Table.HeaderCell>
                    <Table.HeaderCell>Logins</Table.HeaderCell>
                    <Table.HeaderCell>Attempts</Table.HeaderCell>
                    <Table.HeaderCell>Category</Table.HeaderCell>
                    <Table.HeaderCell>Last score</Table.HeaderCell>
                    <Table.HeaderCell>Photo</Table.HeaderCell>
                    <Table.HeaderCell>Action</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {displayedStudents.map(student => {
                    const attempts = student.attempts || [];
                    const last = attempts.length ? attempts[attempts.length - 1] : null;
                    const displayData = getStudentAttemptDisplayData(student);
                    const lastScore = displayData.scoreText || getAttemptScoreText(last);
                    const photo = student.photo || (studentPhotos ? studentPhotos[student.registrationNo] : null);

                    return (
                    <Table.Row key={student.registrationNo}>
                      <Table.Cell>{student.name}</Table.Cell>
                      <Table.Cell>{student.registrationNo}</Table.Cell>
                      <Table.Cell>{student.logins}</Table.Cell>
                      <Table.Cell>{attempts.length}</Table.Cell>
                      <Table.Cell>{displayData.category}</Table.Cell>
                      <Table.Cell>{lastScore}</Table.Cell>
                      <Table.Cell>
                        {photo ? (
                          <Image src={photo} size="tiny" rounded />
                        ) : (
                          <span style={{ color: '#999' }}>No photo</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Button size="small" onClick={() => setSelectedStudent(student)}>
                          View Details
                        </Button>
                        <Button negative size="small" onClick={() => handleDeleteStudent(student.registrationNo)}>
                          Delete
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
            )}
          </>
        )}

        <Modal open={!!selectedStudent} onClose={() => setSelectedStudent(null)} closeIcon size="small">
          <Modal.Header>
            Student Details - {selectedStudent?.name} ({selectedStudent?.registrationNo})
          </Modal.Header>
          <Modal.Content>
            {selectedStudent && (
              <>
                {(selectedStudent.photo || studentPhotos?.[selectedStudent.registrationNo]) && (
                  <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                    <Image
                      src={selectedStudent.photo || studentPhotos[selectedStudent.registrationNo]}
                      size="small"
                      rounded
                      centered
                    />
                    <p style={{ marginTop: '0.8rem' }}>Captured exam photo</p>
                  </div>
                )}
                <Table basic="very" celled>
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell><strong>Name:</strong></Table.Cell>
                      <Table.Cell>{selectedStudent.name}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell><strong>Registration #:</strong></Table.Cell>
                      <Table.Cell>{selectedStudent.registrationNo}</Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell><strong>Total Logins:</strong></Table.Cell>
                      <Table.Cell>{selectedStudent.logins}</Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>

                <Header as="h3" style={{ marginTop: '1rem' }}>
                  Quiz Attempts History
                </Header>
                {(!selectedStudent.attempts || selectedStudent.attempts.length === 0) ? (
                  <Message info content="No quiz attempts yet" />
                ) : (
                  <Table celled compact>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Date</Table.HeaderCell>
                        <Table.HeaderCell>Score</Table.HeaderCell>
                        <Table.HeaderCell>Percentage</Table.HeaderCell>
                        <Table.HeaderCell>Category</Table.HeaderCell>
                        <Table.HeaderCell>Difficulty</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {selectedStudent.attempts.map((attempt, index) => {
                        const percentage = attempt.totalQuestions ?? attempt.total
                          ? Math.round(((attempt.correctAnswers ?? attempt.correct ?? attempt.score ?? 0) / (attempt.totalQuestions ?? attempt.total ?? 1)) * 100)
                          : 0;
                        return (
                          <Table.Row key={`${attempt.date}-${index}`}>
                            <Table.Cell>{new Date(attempt.date).toLocaleString()}</Table.Cell>
                            <Table.Cell>{getAttemptScoreText(attempt)}</Table.Cell>
                            <Table.Cell>{`${percentage}%`}</Table.Cell>
                            <Table.Cell>{getCategoryLabel(attempt.category)}</Table.Cell>
                            <Table.Cell>{attempt.difficulty || 'N/A'}</Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table>
                )}
              </>
            )}
          </Modal.Content>
          <Modal.Actions>
            <Button onClick={() => setSelectedStudent(null)}>Close</Button>
          </Modal.Actions>
        </Modal>

        <Button color="red" onClick={onLogout} style={{ marginTop: '1rem' }}>
          Logout
        </Button>
      </Segment>
    </Container>
  );
};

const App = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(null);
  const [data, setData] = useState(null);
  const [countdownTime, setCountdownTime] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [student, setStudent] = useState(null);
  const [history, setHistory] = useState(getStoredHistory);
  const [studentPhoto, setStudentPhoto] = useState(null);
  const [studentPhotos, setStudentPhotos] = useState(getStoredPhotos);
  const [pendingPhotoUploads, setPendingPhotoUploads] = useState(getStoredPendingPhotos);
  const [quizSettings, setQuizSettings] = useState(getStoredQuizSettings);
  const [quizSession, setQuizSession] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const updateQuizSession = updates => {
    setQuizSession(prev => {
      if (!prev || !prev.studentRegistrationNo) return prev;
      const nextSession = { ...prev, ...updates };
      saveQuizSessionToStorage(prev.studentRegistrationNo, nextSession);
      if (isOnline) {
        saveServerQuizSession(prev.studentRegistrationNo, nextSession).catch(error => {
          console.warn('Failed to sync session to server:', error);
        });
      }
      return nextSession;
    });
  };
  const [serverAvailable, setServerAvailable] = useState(true);

  const checkServerAvailability = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/export/summary`, {
        method: 'GET',
        cache: 'no-cache',
      });

      setServerAvailable(response.ok);
      return response.ok;
    } catch (error) {
      console.warn('Backend availability check failed:', error);
      setServerAvailable(false);
      return false;
    }
  }, []);

  const fetchQuizSettingsFromServer = useCallback(async () => {
    if (!isOnline) return;

    try {
      const response = await fetch(`${API_URL}/quiz-settings`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-cache',
      });

      if (!response.ok) return;

      const payload = await response.json();
      if (Array.isArray(payload.quizSettings)) {
        setQuizSettings(payload.quizSettings);
        try {
          window.localStorage.setItem('quizSettings', JSON.stringify(payload.quizSettings));
        } catch (e) {
          /* ignore localStorage errors */
        }
      }
    } catch (error) {
      console.warn('Could not fetch quiz settings:', error);
    }
  }, [isOnline]);

  const saveQuizSettingsToServer = useCallback(async (settings) => {
    // Persist immediately locally so refresh does not lose admin changes
    setQuizSettings(settings);
    try {
      window.localStorage.setItem('quizSettings', JSON.stringify(settings));
    } catch (e) {
      /* ignore */
    }

    // Notify other tabs in the same browser
    try {
      window.dispatchEvent(new Event('quiz-sync'));
    } catch (e) {
      /* ignore */
    }

    // Background attempt to persist to server (best-effort)
    if (!isOnline) return;

    try {
      const response = await fetch(`${API_URL}/quiz-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizSettings: settings }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        console.warn('Failed to save quiz settings to server', payload?.error || response.status);
        return;
      }

      const payload = await response.json();
      if (Array.isArray(payload.quizSettings)) {
        setQuizSettings(payload.quizSettings);
        try {
          window.localStorage.setItem('quizSettings', JSON.stringify(payload.quizSettings));
        } catch (e) {}
      }
    } catch (error) {
      console.warn('Could not save quiz settings to server:', error);
    }
  }, [isOnline]);

  const enqueuePhotoUpload = (registrationNo, photoUrl) => {
    if (!registrationNo || !photoUrl) return;
    setPendingPhotoUploads(prev => ({
      ...prev,
      [registrationNo]: photoUrl,
    }));
  };

  const uploadStudentPhoto = useCallback(async (registrationNo, photoUrl, skipQueue = false) => {
    if (!registrationNo || !photoUrl) return false;

    if (!isOnline) {
      if (!skipQueue) enqueuePhotoUpload(registrationNo, photoUrl);
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/student-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNo, photo: photoUrl }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || `Server returned ${response.status}`);
      }

      const payload = await response.json();
      if (payload && payload.success && payload.student) {
        setHistory(prev => ({
          ...prev,
          [registrationNo]: payload.student,
        }));
        window.dispatchEvent(new Event('quiz-sync'));
      }

      return true;
    } catch (error) {
      console.warn('Could not upload student photo:', error);
      if (!skipQueue) enqueuePhotoUpload(registrationNo, photoUrl);
      return false;
    }
  }, [isOnline]);

  const flushPendingPhotoUploads = useCallback(async () => {
    if (!isOnline) return;
    const entries = Object.entries(pendingPhotoUploads);
    if (!entries.length) return;

    for (const [registrationNo, photoUrl] of entries) {
      const success = await uploadStudentPhoto(registrationNo, photoUrl, true);
      if (success) {
        setPendingPhotoUploads(prev => {
          const next = { ...prev };
          delete next[registrationNo];
          return next;
        });
      }
    }
  }, [isOnline, pendingPhotoUploads, uploadStudentPhoto]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      flushPendingPhotoUploads();
    }
  }, [isOnline, pendingPhotoUploads, flushPendingPhotoUploads]);

  useEffect(() => {
    if (isOnline) {
      checkServerAvailability();
    } else {
      setServerAvailable(false);
    }
  }, [isOnline, checkServerAvailability]);

  useEffect(() => {
    if (isOnline) {
      fetchQuizSettingsFromServer();
    }
  }, [isOnline, fetchQuizSettingsFromServer]);

  useEffect(() => {
    if (!isOnline) return undefined;

    const interval = setInterval(fetchQuizSettingsFromServer, 10000);
    return () => clearInterval(interval);
  }, [fetchQuizSettingsFromServer, isOnline]);

  useEffect(() => {
    if (!isOnline) return undefined;

    const handleFocus = () => fetchQuizSettingsFromServer();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchQuizSettingsFromServer, isOnline]);

  useEffect(() => {
    try {
      window.localStorage.setItem('quizStudentHistory', JSON.stringify(history));
    } catch (err) {
      console.warn('Unable to persist student history to localStorage:', err);
    }
  }, [history]);

  useEffect(() => {
    try {
      const photosToPersist = sanitizeStoredPhotoMap(studentPhotos);
      if (Object.keys(photosToPersist).length !== Object.keys(studentPhotos).length) {
        setStudentPhotos(photosToPersist);
      }
      window.localStorage.setItem('quizStudentPhotos', JSON.stringify(photosToPersist));
    } catch (err) {
      console.warn('Unable to persist student photos to localStorage:', err);
    }
  }, [studentPhotos]);

  useEffect(() => {
    try {
      const pendingPhotosToPersist = sanitizeStoredPhotoMap(pendingPhotoUploads);
      if (Object.keys(pendingPhotosToPersist).length !== Object.keys(pendingPhotoUploads).length) {
        setPendingPhotoUploads(pendingPhotosToPersist);
      }
      window.localStorage.setItem('quizPendingStudentPhotos', JSON.stringify(pendingPhotosToPersist));
    } catch (err) {
      console.warn('Unable to persist pending photo uploads to localStorage:', err);
    }
  }, [pendingPhotoUploads]);

  useEffect(() => {
    try {
      window.localStorage.setItem('quizSettings', JSON.stringify(quizSettings));
    } catch (err) {
      console.warn('Unable to persist quiz settings to localStorage:', err);
    }
  }, [quizSettings]);

  useEffect(() => {
    if (!student || student.isAdmin) {
      setStudentPhoto(null);
      return undefined;
    }

    setStudentPhoto(studentPhotos[student.registrationNo] || null);
    return undefined;
  }, [student, studentPhotos]);

  useEffect(() => {
    if (!student || student.isAdmin) return undefined;

    const syncStudent = async () => {
      try {
        const response = await fetch(`${API_URL}/students/${student.registrationNo}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.student) {
          setHistory(prev => ({
            ...prev,
            [student.registrationNo]: data.student,
          }));
        }
      } catch (error) {
        console.log('Could not sync with backend:', error);
      }
    };

    syncStudent();

    const handleFocus = () => syncStudent();
    window.addEventListener('focus', handleFocus);

    return () => window.removeEventListener('focus', handleFocus);
  }, [student]);

  const saveQuizAttempt = async attemptData => {
    if (!student || student.isAdmin) return;

    const attempt = {
      date: new Date().toISOString(),
      ...attemptData,
    };

    const nextStudentState = prev => {
      const existing = prev[student.registrationNo] || {
        name: student.name,
        registrationNo: student.registrationNo,
        logins: 0,
        attempts: [],
      };

      const updatedAttempts = [...(existing.attempts || []), attempt];
      const latestAttempt = updatedAttempts[updatedAttempts.length - 1] || null;

      return {
        ...prev,
        [student.registrationNo]: {
          ...existing,
          attempts: updatedAttempts,
          lastCategory: latestAttempt?.category ?? existing.lastCategory,
          lastScoreText: getAttemptScoreText(latestAttempt) || existing.lastScoreText,
        },
      };
    };

    setHistory(prev => nextStudentState(prev));

    if (!isOnline) {
      console.log('Backend offline, data saved locally');
      return;
    }

    try {
      const resp = await fetch(`${API_URL}/quiz-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNo: student.registrationNo, attempt, photo: studentPhoto }),
      });

      if (resp.ok) {
        try {
          const payload = await resp.json();
          if (payload && payload.success && payload.student) {
            setHistory(prev => ({
              ...prev,
              [payload.student.registrationNo]: {
                ...prev[payload.student.registrationNo],
                ...payload.student,
                attempts: payload.student.attempts || prev[payload.student.registrationNo]?.attempts || [],
                lastCategory: payload.student.lastCategory ?? payload.student.category ?? prev[payload.student.registrationNo]?.lastCategory,
                lastScoreText: payload.student.lastScoreText ?? getAttemptScoreText(payload.student.attempts?.[payload.student.attempts.length - 1]) ?? prev[payload.student.registrationNo]?.lastScoreText,
              },
            }));
            // notify other parts of the app (admin panel) to refresh from server
            try {
              window.dispatchEvent(new Event('quiz-sync'));
            } catch (e) {
              /* ignore in non-browser environments */
            }
          }
        } catch (parseErr) {
          console.warn('Could not parse quiz-attempt response', parseErr);
        }
      } else {
        console.warn('Server returned non-OK for quiz-attempt', resp.status);
      }
    } catch (error) {
      console.log('Backend offline, data saved locally', error);
    }
  };

  const handleStudentLogin = async ({ name, registrationNo }) => {
    const newStudent = { name, registrationNo, isAdmin: false };
    setStudent(newStudent);

    let existingSession = null;
    const localSession = getStoredQuizSession(registrationNo);

    if (isOnline) {
      try {
        const serverSession = await fetchServerQuizSession(registrationNo);
        if (serverSession && Array.isArray(serverSession.data) && serverSession.data.length) {
          existingSession = serverSession;
        }
      } catch (error) {
        console.warn('Unable to fetch server session:', error);
      }
    }

    if (!existingSession) {
      existingSession = localSession;
    }

    if (existingSession && Array.isArray(existingSession.data) && existingSession.data.length) {
      const elapsedSeconds = Math.floor((Date.now() - existingSession.startTime) / 1000);
      const remainingSeconds = existingSession.countdownSeconds - elapsedSeconds;

      if (remainingSeconds > 0) {
        setData(existingSession.data);
        setCountdownTime(remainingSeconds);
        setQuizSession(existingSession);
        setStudentPhoto(studentPhotos[registrationNo] || null);
        setCurrentView('quiz');

        if (isOnline && !existingSession.serverSynced) {
          saveServerQuizSession(registrationNo, existingSession).catch(() => {});
        }
      } else {
        clearStoredQuizSession(registrationNo);
        if (isOnline) {
          deleteServerQuizSession(registrationNo).catch(() => {});
        }
        setQuizSession(null);
        setCurrentView('camera');
      }
    } else {
      setCurrentView('camera');
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, registrationNo }),
      });

      const payload = await response.json();
      if (payload.success && payload.student) {
        setHistory(prev => ({
          ...prev,
          [registrationNo]: payload.student,
        }));

        if (!existingSession && payload.session) {
          const serverSession = payload.session;
          const elapsedSeconds = Math.floor((Date.now() - serverSession.startTime) / 1000);
          const remainingSeconds = serverSession.countdownSeconds - elapsedSeconds;
          if (remainingSeconds > 0 && Array.isArray(serverSession.data) && serverSession.data.length) {
            setData(serverSession.data);
            setCountdownTime(remainingSeconds);
            setQuizSession(serverSession);
            setStudentPhoto(studentPhotos[registrationNo] || null);
            setCurrentView('quiz');
          }
        }
      }
    } catch (error) {
      console.log('Backend offline, using local data', error);
      setHistory(prev => {
        const existing = prev[registrationNo] || {
          name,
          registrationNo,
          logins: 0,
          attempts: [],
        };

        return {
          ...prev,
          [registrationNo]: {
            ...existing,
            logins: existing.logins + 1,
          },
        };
      });
    }
  };

  const handleAdminLogin = () => {
    setStudent({ name: 'Faculty', registrationNo: 'faculty', isAdmin: true });
    setCurrentView('admin');
  };

  const handleHodLogin = async ({ username, password }) => {
    if (!isOnline) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/hod-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json();
      if (response.ok && payload.success) {
        setStudent({ name: payload.user.username, registrationNo: payload.user.username, isAdmin: true, role: 'hod' });
        setCurrentView('admin');
        return true;
      }
    } catch (error) {
      console.warn('HOD login failed:', error);
    }

    return false;
  };

  const handlePhotoCaptured = photoUrl => {
    if (!student || student.isAdmin) return;

    setStudentPhotos(prev => ({
      ...prev,
      [student.registrationNo]: photoUrl,
    }));
    setStudentPhoto(photoUrl);
    setCurrentView('main');
    uploadStudentPhoto(student.registrationNo, photoUrl);
  };

  const handleLogout = () => {
    setStudent(null);
    setStudentPhoto(null);
    setQuizSession(null);
    setCurrentView('login');
    setData(null);
    setCountdownTime(null);
    setResultData(null);
    setLoading(false);
    setLoadingMessage(null);
  };

  const startQuiz = (quizData, countdownSeconds) => {
    const newSession = {
      studentRegistrationNo: student?.registrationNo || null,
      data: quizData,
      countdownSeconds,
      startTime: Date.now(),
      currentQuestionIndex: 0,
      selectedAnswers: {},
    };

    if (student?.registrationNo) {
      saveQuizSessionToStorage(student.registrationNo, newSession);
      if (isOnline) {
        saveServerQuizSession(student.registrationNo, newSession).catch(error => {
          console.warn('Failed to save quiz session to server:', error);
        });
      }
    }

    setQuizSession(newSession);
    setLoading(true);
    setLoadingMessage({
      title: 'Loading your quiz...',
      message: "It won't be long!",
    });
    setCountdownTime(countdownSeconds);

    setTimeout(() => {
      setData(quizData);
      setCurrentView('quiz');
      setLoading(false);
    }, 1000);
  };

  const endQuiz = result => {
    if (student?.registrationNo) {
      clearStoredQuizSession(student.registrationNo);
      if (isOnline) {
        deleteServerQuizSession(student.registrationNo).catch(error => {
          console.warn('Failed to clear quiz session on server:', error);
        });
      }
    }
    setQuizSession(null);
    setLoading(true);
    setLoadingMessage({
      title: 'Fetching your results...',
      message: 'Just a moment!',
    });

    setTimeout(() => {
      saveQuizAttempt(result);
      setResultData(result);
      setCurrentView('result');
      setLoading(false);
    }, 2000);
  };

  const replayQuiz = () => {
    setLoading(true);
    setLoadingMessage({
      title: 'Getting ready for round two.',
      message: "It won't take long!",
    });

    const shuffledData = shuffle(data);
    shuffledData.forEach(question => {
      question.options = shuffle(question.options);
    });

    const newSession = {
      studentRegistrationNo: student?.registrationNo || null,
      data: shuffledData,
      countdownSeconds: countdownTime,
      startTime: Date.now(),
      currentQuestionIndex: 0,
      selectedAnswers: {},
    };

    if (student?.registrationNo) {
      saveQuizSessionToStorage(student.registrationNo, newSession);
      if (isOnline) {
        saveServerQuizSession(student.registrationNo, newSession).catch(error => {
          console.warn('Failed to save quiz session to server:', error);
        });
      }
    }

    setQuizSession(newSession);
    setData(shuffledData);

    setTimeout(() => {
      setResultData(null);
      setCurrentView('quiz');
      setLoading(false);
    }, 1000);
  };

  const resetQuiz = () => {
    setLoading(true);
    setLoadingMessage({
      title: 'Loading the home screen.',
      message: 'Thank you for playing!',
    });

    setTimeout(() => {
      setData(null);
      setCountdownTime(null);
      setResultData(null);
      setCurrentView('main');
      setLoading(false);
    }, 1000);
  };

  return (
    <Layout>
      {!serverAvailable ? (
        <Segment placeholder textAlign="center" style={{ minHeight: '60vh' }}>
          <Header icon color="red">
            <Icon name="warning circle" />
            Backend server unavailable
            <Header.Subheader>
              The application cannot connect to its backend service.
            </Header.Subheader>
          </Header>
          <Message
            warning
            header={isOnline ? 'Backend service not reachable' : 'No network connection'}
            content={isOnline
              ? 'Please contact the administrator to start the server before using the app.'
              : 'Your device is offline. Check your internet connection and retry.'}
          />
          <Button primary onClick={checkServerAvailability} disabled={!isOnline}>
            Retry Connection
          </Button>
        </Segment>
      ) : (
        <>
          {loading && <Loader {...loadingMessage} />}

          {!loading && currentView === 'login' && (
            <Login
              onLogin={handleStudentLogin}
              onAdminLogin={handleAdminLogin}
              onHodLogin={handleHodLogin}
              hodLoggedIn={!!(student && student.role === 'hod')}
            />
          )}

      {!loading && student && !student.isAdmin && currentView !== 'login' && currentView !== 'camera' && (
        <div style={{ padding: '1rem 0' }}>
          <Menu secondary>
            <Menu.Item>
              <Button
                color="blue"
                primary={currentView === 'monitor'}
                content="Monitor"
                icon="dashboard"
                labelPosition="left"
                onClick={() => setCurrentView('monitor')}
              />
            </Menu.Item>
            <Menu.Menu position="right">
              <Menu.Item>
                <Button
                  color="red"
                  content="Logout"
                  onClick={handleLogout}
                />
              </Menu.Item>
            </Menu.Menu>
          </Menu>
        </div>
      )}

      {!loading && student && student.isAdmin && currentView !== 'login' && (
        <div style={{ padding: '1rem 0' }}>
          <Menu secondary>
            <Menu.Menu position="right">
              <Menu.Item>
                <Button color="red" content="Logout" onClick={handleLogout} />
              </Menu.Item>
            </Menu.Menu>
          </Menu>
        </div>
      )}

      {!loading && currentView === 'camera' && student && !student.isAdmin && (
        <CameraCapture onCapture={handlePhotoCaptured} />
      )}

      {!loading && currentView === 'main' && (
        <Main startQuiz={startQuiz} quizSettings={quizSettings} />
      )}

      {!loading && currentView === 'quiz' && (
        <Quiz
          data={data}
          countdownTime={countdownTime}
          endQuiz={endQuiz}
          photo={studentPhoto}
          student={student}
          quizSession={quizSession}
          onSessionUpdate={updateQuizSession}
        />
      )}

      {!loading && currentView === 'result' && resultData && (
        <Result
          {...resultData}
          replayQuiz={replayQuiz}
          resetQuiz={resetQuiz}
        />
      )}

      {!loading && currentView === 'monitor' && student && !student.isAdmin && (
        <Monitor student={student} history={history} onBack={() => setCurrentView('main')} />
      )}

      {!loading && currentView === 'admin' && student && student.isAdmin && (
        <AdminPanel
          history={history}
          onLogout={handleLogout}
          isOnline={isOnline}
          apiUrl={API_URL}
          studentPhotos={studentPhotos}
          quizSettings={quizSettings}
          onSaveSettings={saveQuizSettingsToServer}
          hodLoggedIn={!!(student && student.role === 'hod')}
        />
      )}
        </>
      )}
    </Layout>
  );
};

export default App;
