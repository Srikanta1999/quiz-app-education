# Quiz App - Multi-Device Setup

This quiz app now supports **multi-device logins** with persistent data storage on a backend server.

## Architecture

- **Frontend**: React app (existing)
- **Backend**: Node.js + Express server (`server.js`)
- **Data Storage**: JSON file (`data.json`)

## Installation

### 1. Install Backend Dependencies

```bash
npm install express cors
```

The dependencies have been added to `package.json`.

### 2. Run the Application

#### Option A: Run both server and app together (recommended)

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- React app on `http://localhost:3000`

#### Option B: Run them separately

**Terminal 1 - Start the backend:**
```bash
npm run server
```

**Terminal 2 - Start the React app:**
```bash
npm start
```

## Multi-Device Features

### How it works:

1. **Student Login**: When a student logs in from any device:
   - Data is synced to the backend server
   - Login count is incremented
   - Data persists across devices and browsers

2. **Quiz Attempt**: When a student completes a quiz:
   - Result is saved to the backend
   - Faculty dashboard shows updated data from all devices
   - Data is also saved locally for offline support

3. **Faculty Dashboard**: 
   - Shows all students across all devices
   - Data is fetched from the server (shows "Connected to server" when online)
   - Falls back to local data if server is unavailable
   - Can sort students by last score

### API Endpoints

- `POST /api/login` - Record a student login
- `POST /api/quiz-attempt` - Record a quiz attempt
- `GET /api/students` - Get all students data
- `GET /api/students/:registrationNo` - Get specific student data

### Data Persistence

All data is stored in `data.json` file in the project root. This file is automatically created and managed by the backend.

## Offline Support

- If the backend is not running, the app works in **offline mode**
- Data is stored locally in `localStorage`
- When the server comes back online, data can be synced

## Multi-device configuration

- If you access the app from multiple devices, make sure each client points to the same backend host.
- Set `REACT_APP_API_URL=http://<server-ip>:5000/api` on each device when the backend server is not running on the local machine.
- Example: `REACT_APP_API_URL=http://192.168.1.100:5000/api`

## Security Notes

⚠️ **For development only** - The current setup:
- Has no authentication
- Stores data in plain JSON
- Uses hardcoded faculty password

For production, consider:
- Adding proper authentication (JWT, sessions)
- Using a real database (MongoDB, PostgreSQL)
- Implementing data encryption
- Adding access controls

## Troubleshooting

**Q: Getting CORS error?**
- Make sure the backend server is running on port 5000
- The React app should be on port 3000

**Q: Backend not starting?**
- Check if port 5000 is already in use
- Try: `npm run server` with a different PORT

**Q: Data not syncing?**
- Check browser console for errors
- Verify backend is running: `http://localhost:5000/api/students`
- Check that CORS is enabled (it should be)

## File Locations

- **Backend Server**: `server.js`
- **Data Storage**: `data.json` (created automatically)
- **React App**: `src/components/App/index.js`
- **Faculty Login**: `src/components/Login/index.js` (password: `admin123`)
