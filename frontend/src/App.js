import './App.css';
import { Route, BrowserRouter as Router, Routes, Navigate } from 'react-router-dom';
import LandingPage       from './pages/landing';
import Authentication    from './pages/authentication';
import { AuthProvider }  from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import VideoMeetComponent from './pages/VideoMeet';
import HomeComponent     from './pages/home';
import History           from './pages/history';
import GuestPage         from './pages/GuestPage';
import ForgotPassword    from './pages/ForgotPassword';   // #12

function App() {
  return (
    <div className="App">
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route path='/'                element={<LandingPage />} />
              <Route path='/auth'            element={<Authentication />} />
              <Route path='/guest'           element={<GuestPage />} />
              <Route path='/forgot-password' element={<ForgotPassword />} />  {/* #12 */}
              <Route path='/home'            element={<HomeComponent />} />
              <Route path='/history'         element={<History />} />
              <Route path='/:url'            element={<VideoMeetComponent />} />
              <Route path='*'               element={<Navigate to='/' replace />} />
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </div>
  );
}

export default App;
