import './App.css';
import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router-dom';
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/VideoMeet';
import HomeComponent from './pages/home';
import History from './pages/history';
import GuestPage from './pages/GuestPage.jsx'; // NEW

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path='/'        element={<LandingPage />} />
            <Route path='/auth'    element={<Authentication />} />
            <Route path='/guest'   element={<GuestPage />} />  {/* NEW */}
            <Route path='/home'    element={<HomeComponent />} />
            <Route path='/history' element={<History />} />
            <Route path='/:url'    element={<VideoMeetComponent />} />
            {/* 404 fallback */}
            <Route path='*'        element={<Navigate to='/' replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
