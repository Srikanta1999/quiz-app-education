const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');
const DB_FILE = path.join(__dirname, 'quiz.db');
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);

const app = express();
let db;
let pool;

if (USE_POSTGRES) {
  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
  };

  if (process.env.DB_SSL === 'true' || process.env.PGSSLMODE === 'require') {
    poolConfig.ssl = {
      rejectUnauthorized: false,
    };
  }

  pool = new Pool(poolConfig);
} else {
  db = new Database(DB_FILE, { fileMustExist: false });
}

app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5000;
const rateLimitStore = new Map();

const cleanupRateLimitStore = () => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
};
setInterval(cleanupRateLimitStore, 30 * 60 * 1000);

const isLocalhostIp = ip => {
  if (!ip) return false;
  return ['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost'].includes(ip);
};

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (req.method === 'DELETE' || isLocalhostIp(ip)) {
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS_PER_WINDOW);
    return next();
  }

  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  rateLimitStore.set(ip, entry);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000));

  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }

  next();
};

// Run without business-hours enforcement (24/7 availability)
app.use(rateLimiter);

// Simple request logger to help diagnose synchronization issues
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

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

const defaultData = { students: [], quizSettings: defaultQuizSettings, hods: [], quizSessions: {} };

const normalizeData = data => ({
  students: Array.isArray(data?.students) ? data.students : [],
  quizSettings: Array.isArray(data?.quizSettings) ? data.quizSettings : defaultQuizSettings,
  hods: Array.isArray(data?.hods) ? data.hods : [],
  quizSessions: data?.quizSessions && typeof data.quizSessions === 'object' ? data.quizSessions : {},
});

const initializeDatabase = async () => {
  if (USE_POSTGRES) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )
    `);

    const existingRow = await pool.query('SELECT value FROM app_data WHERE key = $1', ['main']);
    if (existingRow.rows.length) {
      return;
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const content = fs.readFileSync(DATA_FILE, 'utf8');
        if (content) {
          const parsed = JSON.parse(content);
          await saveData(normalizeData(parsed));
          return;
        }
      } catch (error) {
        console.error('Failed to migrate legacy data.json to Postgres:', error);
      }
    }

    await saveData(defaultData);
    return;
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS app_data (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  const existingRow = db.prepare('SELECT value FROM app_data WHERE key = ?').get('main');
  if (existingRow) {
    return;
  }

  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf8');
      if (content) {
        const parsed = JSON.parse(content);
        await saveData(normalizeData(parsed));
        return;
      }
    } catch (error) {
      console.error('Failed to migrate legacy data.json to SQLite:', error);
    }
  }

  await saveData(defaultData);
};

const loadData = async () => {
  if (USE_POSTGRES) {
    try {
      const row = await pool.query('SELECT value FROM app_data WHERE key = $1', ['main']);
      if (!row.rows.length) {
        await initializeDatabase();
        return normalizeData(defaultData);
      }
      return normalizeData(row.rows[0].value);
    } catch (error) {
      console.error('Failed to load Postgres data:', error);
      return normalizeData(defaultData);
    }
  }

  const row = db.prepare('SELECT value FROM app_data WHERE key = ?').get('main');
  if (!row) {
    await initializeDatabase();
    return normalizeData(defaultData);
  }

  try {
    return normalizeData(JSON.parse(row.value));
  } catch (error) {
    console.error('Failed to load SQLite data:', error);
    return normalizeData(defaultData);
  }
};

const saveData = async data => {
  try {
    const normalizedData = normalizeData(data);

    if (USE_POSTGRES) {
      await pool.query(
        'INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        ['main', normalizedData]
      );
      return;
    }

    db.prepare('INSERT INTO app_data (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      'main',
      JSON.stringify(normalizedData, null, 2)
    );
  } catch (error) {
    console.error('Failed to save data:', error);
  }
};

const startApp = async () => {
  try {
    await initializeDatabase();
    startServer(PORT);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
};

const findStudent = (data, registrationNo) =>
  data.students.find(student => student.registrationNo === registrationNo);

const getAttemptScoreText = attempt => {
  if (!attempt || typeof attempt !== 'object') return 'N/A';

  const correctAnswers = attempt.correctAnswers ?? attempt.correct ?? attempt.score ?? attempt.correctCount;
  const totalQuestions = attempt.totalQuestions ?? attempt.total ?? attempt.totalCount;

  if (correctAnswers === undefined || totalQuestions === undefined || correctAnswers === null || totalQuestions === null) {
    return 'N/A';
  }

  return `${correctAnswers}/${totalQuestions}`;
};

const enrichStudentWithAttemptMeta = student => {
  if (!student || typeof student !== 'object') return student;

  const attempts = Array.isArray(student.attempts) ? student.attempts : [];
  const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;

  if (!lastAttempt) {
    return student;
  }

  const nextStudent = { ...student };
  nextStudent.lastCategory = lastAttempt.category ?? student.lastCategory ?? student.category ?? null;
  nextStudent.lastScoreText = getAttemptScoreText(lastAttempt) || student.lastScoreText;
  nextStudent.lastAttempt = lastAttempt;
  return nextStudent;
};

const getQuizSession = (data, registrationNo) =>
  data.quizSessions && data.quizSessions[registrationNo] ? data.quizSessions[registrationNo] : null;

const setQuizSession = (data, registrationNo, session) => {
  data.quizSessions = data.quizSessions || {};
  data.quizSessions[registrationNo] = session;
};

const clearQuizSession = (data, registrationNo) => {
  if (data.quizSessions) {
    delete data.quizSessions[registrationNo];
  }
};

const findHod = (data, username) =>
  data.hods.find(hod => hod.username === username);

const computeSummary = data => {
  const students = data.students || [];
  const totalAttempts = students.reduce((sum, student) => sum + ((student.attempts || []).length), 0);
  const totalScore = students.reduce((sum, student) => {
    const attempts = student.attempts || [];
    if (!attempts.length) return sum;
    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt.totalQuestions) return sum;
    return sum + (lastAttempt.correctAnswers / lastAttempt.totalQuestions) * 100;
  }, 0);
  const averageScore = students.length ? Math.round(totalScore / students.length) : 0;

  const topStudent = students.reduce((best, student) => {
    const attempts = student.attempts || [];
    if (!attempts.length) return best;
    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt.totalQuestions) return best;
    const score = Math.round((lastAttempt.correctAnswers / lastAttempt.totalQuestions) * 100);

    if (!best || score > best.score) {
      return {
        student,
        score,
        lastAttempt,
      };
    }

    return best;
  }, null);

  return {
    totalStudents: students.length,
    totalAttempts,
    averageScore,
    topStudent: topStudent ? {
      name: topStudent.student.name,
      registrationNo: topStudent.student.registrationNo,
      score: topStudent.score,
      lastAttempt: topStudent.lastAttempt,
    } : null,
  };
};

const createCsv = students => {
  const header = ['Name', 'Registration No', 'Category', 'Logins', 'Attempts', 'Last Score', 'Last Percentage', 'Average Score'];
  const rows = students.map(student => {
    const attempts = student.attempts || [];
    const lastAttempt = attempts.length ? attempts[attempts.length - 1] : null;
    const lastScore = lastAttempt ? `${lastAttempt.correctAnswers}/${lastAttempt.totalQuestions}` : 'N/A';
    const lastPercentage = lastAttempt && lastAttempt.totalQuestions
      ? `${Math.round((lastAttempt.correctAnswers / lastAttempt.totalQuestions) * 100)}%`
      : 'N/A';
    const averageScore = attempts.length
      ? `${Math.round(attempts.reduce((sum, attempt) => {
          if (!attempt.totalQuestions) return sum;
          return sum + (attempt.correctAnswers / attempt.totalQuestions) * 100;
        }, 0) / attempts.length)}%`
      : 'N/A';

    // Determine category label from last attempt if available
    let categoryLabel = 'N/A';
    if (lastAttempt && lastAttempt.category !== undefined && lastAttempt.category !== null) {
      const cat = lastAttempt.category;
      categoryLabel = CATEGORY_LABELS_BY_ID[String(cat)] || String(cat);
    }

    return [
      student.name,
      student.registrationNo,
      categoryLabel,
      student.logins || 0,
      attempts.length,
      lastScore,
      lastPercentage,
      averageScore,
    ];
  });

  const csvLines = [header.join(','), ...rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))];
  return csvLines.join('\n');
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/quiz-settings', async (req, res) => {
  const data = await loadData();
  res.json({ quizSettings: data.quizSettings || defaultQuizSettings });
});

app.post('/api/quiz-settings', async (req, res) => {
  const { quizSettings } = req.body;

  if (!Array.isArray(quizSettings)) {
    return res.status(400).json({ success: false, error: 'quizSettings must be an array.' });
  }

  const data = await loadData();
  data.quizSettings = quizSettings;
  await saveData(data);

  res.json({ success: true, quizSettings: data.quizSettings });
});

app.get('/api/hods', async (req, res) => {
  const data = await loadData();
  res.json({ hods: data.hods || [] });
});

app.post('/api/hods', async (req, res) => {
  const data = await loadData();
  const { username, password, hods } = req.body;
  const added = [];

  const addHod = hod => {
    if (!hod || !hod.username || !hod.password) return;
    if (!findHod(data, hod.username)) {
      data.hods.push({ username: hod.username, password: hod.password });
      added.push({ username: hod.username, password: hod.password });
    }
  };

  if (Array.isArray(hods)) {
    hods.forEach(addHod);
  } else if (username && password) {
    if (findHod(data, username)) {
      return res.status(409).json({ success: false, error: 'HOD username already exists.' });
    }
    addHod({ username, password });
  } else {
    return res.status(400).json({ success: false, error: 'username and password are required.' });
  }

  await saveData(data);
  res.json({ success: true, hods: data.hods, added });
});

app.delete('/api/hods/:username', async (req, res) => {
  const data = await loadData();
  const username = req.params.username;
  const index = data.hods.findIndex(hod => hod.username === username);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'HOD not found.' });
  }
  data.hods.splice(index, 1);
  await saveData(data);
  res.json({ success: true });
});

app.post('/api/hod-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }
  const data = await loadData();
  const hod = findHod(data, username);
  if (!hod || hod.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid HOD credentials.' });
  }
  res.json({ success: true, user: { username: hod.username, role: 'hod' } });
});

const CATEGORY_LABELS_BY_ID = {
  '9': 'Apptitude',
  '10': 'Reasoning',
  '11': 'Coding',
  '12': 'Research',
  '13': 'EEE',
  '14': 'ME',
  '15': 'CIVIL',
  '16': 'Entertainment: Board Games',
  '17': 'Science & Nature',
  '18': 'Science: Computers',
  '19': 'Science: Mathematics',
  '20': 'Mythology',
  '21': 'Sports',
  '22': 'Geography',
  '23': 'History',
  '24': 'Politics',
  '25': 'Arts',
  '26': 'Celebrities',
  '27': 'Animals',
  '28': 'Vehicles',
  '29': 'Entertainment: Comics',
  '30': 'Science: Gadgets',
  '31': 'Entertainment: Japanese Anime & Manga',
  '32': 'Entertainment: Cartoon & Animations',
};

app.get('/api/students', async (req, res) => {
  const data = await loadData();
  const { category, quizName } = req.query;
  let students = (data.students || []).map(enrichStudentWithAttemptMeta);

  const categoryFilter = category && String(category) !== '0';
  const quizNameFilter = quizName && String(quizName).trim() !== '';
  const normalizedQuizName = quizNameFilter ? String(quizName).trim().toLowerCase() : '';

  if (categoryFilter || quizNameFilter) {
    const categoryLabel = categoryFilter ? CATEGORY_LABELS_BY_ID[String(category)] : null;
    students = students.filter(student =>
      (student.attempts || []).some(attempt => {
        const categoryMatches = !categoryFilter ||
          String(attempt.category) === String(category) ||
          (categoryLabel && String(attempt.category) === String(categoryLabel));

        const quizNameMatches = !quizNameFilter ||
          String(attempt.quizName || '')
            .toLowerCase()
            .includes(normalizedQuizName);

        return categoryMatches && quizNameMatches;
      })
    );
  }

  res.json({ students });
});

app.get('/api/students/:registrationNo', async (req, res) => {
  const data = await loadData();
  const student = findStudent(data, req.params.registrationNo);
  res.json({ student: student ? enrichStudentWithAttemptMeta(student) : null });
});

app.post('/api/login', async (req, res) => {
  const { name, registrationNo } = req.body;

  if (!name || !registrationNo) {
    return res.status(400).json({ success: false, error: 'Name and registration number are required.' });
  }

  const data = await loadData();
  let student = findStudent(data, registrationNo);

  if (!student) {
    student = {
      name,
      registrationNo,
      logins: 1,
      attempts: [],
    };
    data.students.push(student);
  } else {
    student.name = name;
    student.logins = (student.logins || 0) + 1;
  }

  const enrichedStudent = enrichStudentWithAttemptMeta(student);
  await saveData(data);
  const session = getQuizSession(data, registrationNo);
  res.json({ success: true, student: enrichedStudent, session });
});

app.get('/api/quiz-session/:registrationNo', async (req, res) => {
  const data = await loadData();
  const registrationNo = req.params.registrationNo;
  if (!registrationNo) {
    return res.status(400).json({ success: false, error: 'Registration number is required.' });
  }
  const session = getQuizSession(data, registrationNo);
  res.json({ success: true, session });
});

app.post('/api/quiz-session', async (req, res) => {
  const { registrationNo, session } = req.body;
  if (!registrationNo || !session) {
    return res.status(400).json({ success: false, error: 'Registration number and session are required.' });
  }
  const data = await loadData();
  setQuizSession(data, registrationNo, session);
  await saveData(data);
  res.json({ success: true, session });
});

app.delete('/api/quiz-session/:registrationNo', async (req, res) => {
  const data = await loadData();
  const registrationNo = req.params.registrationNo;
  if (!registrationNo) {
    return res.status(400).json({ success: false, error: 'Registration number is required.' });
  }
  clearQuizSession(data, registrationNo);
  await saveData(data);
  res.json({ success: true });
});

app.post('/api/quiz-attempt', async (req, res) => {
  const { registrationNo, attempt, photo } = req.body;

  if (!registrationNo || !attempt) {
    return res.status(400).json({ success: false, error: 'Registration number and attempt are required.' });
  }

  const data = await loadData();
  let student = findStudent(data, registrationNo);

  if (!student) {
    student = {
      name: 'Unknown',
      registrationNo,
      logins: 0,
      attempts: [attempt],
      photo: photo || null,
    };
    data.students.push(student);
  } else {
    student.attempts = student.attempts || [];
    student.attempts.push(attempt);
    if (photo) {
      student.photo = photo;
    }
  }

  const enrichedStudent = enrichStudentWithAttemptMeta(student);
  await saveData(data);
  // Return the updated student record to help clients confirm synchronization
  res.json({ success: true, student: enrichedStudent });
});

app.post('/api/student-photo', async (req, res) => {
  const { registrationNo, photo } = req.body;

  if (!registrationNo || !photo) {
    return res.status(400).json({ success: false, error: 'Registration number and photo are required.' });
  }

  const data = await loadData();
  let student = findStudent(data, registrationNo);

  if (!student) {
    student = {
      name: 'Unknown',
      registrationNo,
      logins: 0,
      attempts: [],
      photo,
    };
    data.students.push(student);
  } else {
    student.photo = photo;
  }

  await saveData(data);
  res.json({ success: true, student });
});

app.delete('/api/students/:registrationNo', async (req, res) => {
  const data = await loadData();
  const registrationNo = decodeURIComponent(req.params.registrationNo || '');

  if (!registrationNo) {
    return res.status(400).json({ success: false, error: 'Registration number is required.' });
  }

  const index = data.students.findIndex(student => student.registrationNo === registrationNo);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Student not found.' });
  }

  data.students.splice(index, 1);
  await saveData(data);
  res.json({ success: true });
});

app.delete('/api/students', async (req, res) => {
  const data = await loadData();
  data.students = [];
  await saveData(data);
  res.json({ success: true });
});

app.get('/api/export/summary', async (req, res) => {
  const data = await loadData();
  res.json({ summary: computeSummary(data) });
});

app.get('/api/export/json', async (req, res) => {
  const data = await loadData();
  res.setHeader('Content-Disposition', 'attachment; filename="students.json"');
  res.json(data);
});

app.get('/api/export/csv', async (req, res) => {
  const data = await loadData();
  const csv = createCsv(data.students);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
  res.send(csv);
});

// Serve React frontend build assets for any non-API requests.
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API route not found.' });
  }
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const closeResources = async () => {
  try {
    if (USE_POSTGRES && pool) {
      await pool.end();
    }
    if (!USE_POSTGRES && db) {
      db.close();
    }
  } catch (error) {
    console.error('Error closing resources:', error);
  }
};

process.on('SIGINT', async () => {
  await closeResources();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeResources();
  process.exit(0);
});

const startServer = (port, attempt = 1) => {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${port}`);
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && attempt < 10) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Trying ${nextPort} instead.`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error(`Failed to start server on port ${port}:`, error);
    process.exit(1);
  });
};

startApp();
